// Cloud sync. Loaded after shared.js (so KA_records/KA_history already exist) and before
// every game module (so its patched versions are what they end up calling — they always
// call window.KA_records.set(...) at call time, never a captured reference, so patch order
// relative to game-file load doesn't matter as long as this runs before any real gameplay).
//
// Games never talk to Supabase directly. They call the exact same KA_records.set /
// KA_history.add they always have; this file is the only thing that knows a network exists.
(function(){
  if (typeof window.supabase === 'undefined' || !window.KA_SUPABASE_URL){
    console.warn('Supabase client not loaded — playing in local-only mode.');
    window.KA_cloud = {
      enabled: false,
      isSignedIn(){ return false; },
      onAuthChange(fn){ fn(null); },
      onPasswordRecovery(){},
      onSignedIn(){},
      async checkUsernameAvailable(){ throw new Error('Cloud sync is not configured.'); },
      async signUpWithPassword(){ throw new Error('Cloud sync is not configured.'); },
      async signInWithIdentifier(){ throw new Error('Cloud sync is not configured.'); },
      async sendPasswordReset(){ throw new Error('Cloud sync is not configured.'); },
      async updatePassword(){ throw new Error('Cloud sync is not configured.'); },
      async getMyProfile(){ return null; },
      async updateUsername(){ throw new Error('Cloud sync is not configured.'); },
      async signOut(){}
    };
    return;
  }

  const sb = window.supabase.createClient(window.KA_SUPABASE_URL, window.KA_SUPABASE_ANON_KEY);
  const listeners = [];
  const recoveryListeners = [];
  const signedInListeners = [];
  const state = { session: null, ready: false };

  function notify(){ listeners.forEach(fn => fn(state.session)); }

  // Whichever account this browser's local data currently belongs to. Without this, a
  // second person signing in on the same browser would have their cloud bests compared
  // against whatever the FIRST person left in localStorage — and if that leftover data
  // happened to look "better", it would get pushed up onto the second person's account,
  // silently mixing two players' scores together.
  const OWNER_KEY = 'ka_cloud_owner';
  function wipeLocalGameData(){
    const keys = [];
    for (let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      if (k && k.indexOf('ka_') === 0 && k !== OWNER_KEY) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  }

  // ---- pull the signed-in player's cloud bests down, merging by whichever is actually
  // better rather than blindly overwriting — a fresh browser has nothing locally and should
  // take everything from the cloud; a browser that's been played offline since the last
  // sync may be ahead on some keys, and those get pushed back up instead.
  async function pullAndMerge(session){
    const prevOwner = localStorage.getItem(OWNER_KEY);
    if (prevOwner && prevOwner !== session.user.id) wipeLocalGameData();
    localStorage.setItem(OWNER_KEY, session.user.id);

    const { data, error } = await sb
      .from('records')
      .select('key, value, higher_is_better')
      .eq('user_id', session.user.id);
    if (error){ console.error('cloud pull failed:', error.message); return; }

    data.forEach(row => {
      const local = window.KA_records.get(row.key, null);
      const cloudIsBetter = local === null ||
        (row.higher_is_better ? row.value > local : row.value < local);
      if (cloudIsBetter){
        localSet(row.key, row.value);
      } else if (local !== row.value){
        pushRecord(session.user.id, row.key, local, row.higher_is_better);
      }
    });
  }

  function pushRecord(userId, key, value, higherIsBetter){
    sb.from('records')
      .upsert({ user_id: userId, key, value, higher_is_better: higherIsBetter !== false, updated_at: new Date().toISOString() },
              { onConflict: 'user_id,key' })
      .then(({ error }) => { if (error) console.error('cloud sync (record) failed:', error.message); });
  }

  // ---- patch the two write paths every game already calls ----------------------------
  const localSet = window.KA_records.set.bind(window.KA_records);
  window.KA_records.set = function(key, value, higherIsBetter){
    localSet(key, value);
    if (state.session && typeof value === 'number'){
      pushRecord(state.session.user.id, key, value, higherIsBetter);
    }
  };

  const localAdd = window.KA_history.add.bind(window.KA_history);
  window.KA_history.add = function(gameName, summary){
    localAdd(gameName, summary);
    if (state.session){
      sb.from('runs')
        .insert({ user_id: state.session.user.id, game_name: gameName, summary })
        .then(({ error }) => { if (error) console.error('cloud sync (run) failed:', error.message); });
    }
  };

  window.KA_cloud = {
    enabled: true,
    client: sb,
    get session(){ return state.session; },
    isSignedIn(){ return !!state.session; },
    // Calls fn(session|null) once now (if a session's already resolved) and again on every
    // future sign-in/sign-out.
    onAuthChange(fn){
      listeners.push(fn);
      if (state.ready) fn(state.session);
    },
    // Fires when the player has landed back here from a "reset password" email — the app
    // should show a "set new password" form rather than treating this as a normal sign-in.
    onPasswordRecovery(fn){
      recoveryListeners.push(fn);
    },
    // Fires only on a genuine new sign-in (the SIGN IN / verified-signup / reset-complete
    // moment) — never on a page load that simply restores an existing session. Use this for
    // one-shot UI reactions like closing the modal or a "SIGNED IN" toast; use onAuthChange
    // for anything that should also reflect the state on every load (e.g. the account strip).
    onSignedIn(fn){
      signedInListeners.push(fn);
    },
    // Checked client-side before ever submitting the sign-up form, so a taken name gets
    // caught immediately rather than surfacing as a confusing failure from the trigger's
    // unique-constraint backstop after the fact.
    async checkUsernameAvailable(username){
      const { data, error } = await sb.rpc('username_available', { check_username: username });
      if (error){ console.error('username availability check failed:', error.message); throw error; }
      return !!data;
    },
    async signUpWithPassword(email, password, username){
      const { error } = await sb.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.href, data: { username } }
      });
      if (error) throw error;
    },
    // Accepts either an email or a username. Supabase's own sign-in only understands email
    // (or phone) — a username has to be resolved to its email first via a narrow lookup
    // function, then handed to the normal password sign-in.
    async signInWithIdentifier(identifier, password){
      let email = identifier;
      if (identifier.indexOf('@') === -1){
        const { data, error } = await sb.rpc('email_for_username', { check_username: identifier });
        if (error){ console.error('username lookup failed:', error.message); throw new Error('Could not sign in — check your connection and try again.'); }
        if (!data) throw new Error('No account found with that username.');
        email = data;
      }
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async sendPasswordReset(email){
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.href });
      if (error) throw error;
    },
    // Only valid while a PASSWORD_RECOVERY session is active (i.e. right after following the
    // reset-password email link).
    async updatePassword(newPassword){
      const { error } = await sb.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    async getMyProfile(){
      if (!state.session) return null;
      const { data, error } = await sb.from('profiles').select('username').eq('id', state.session.user.id).single();
      if (error){ console.error('profile fetch failed:', error.message); return null; }
      return data;
    },
    async updateUsername(newUsername){
      if (!state.session) throw new Error('Not signed in.');
      const { error } = await sb.from('profiles').update({ username: newUsername }).eq('id', state.session.user.id);
      if (error) throw error;
    },
    async signOut(){
      await sb.auth.signOut();
    },
    // Top N players for a given KA_records key, joined with their username.
    async fetchLeaderboard(key, higherIsBetter, limit){
      const { data, error } = await sb
        .from('records')
        .select('value, updated_at, profiles(username)')
        .eq('key', key)
        .order('value', { ascending: !higherIsBetter })
        .limit(limit || 20);
      if (error){ console.error('leaderboard fetch failed:', error.message); return []; }
      return data;
    },
    // The signed-in player's own position on a leaderboard, without pulling every row —
    // just their value, then a count of how many players beat it. { played:false } if they
    // have no record for this key yet; null if signed out or the fetch failed outright.
    async fetchMyRank(key, higherIsBetter){
      if (!state.session) return null;
      const { data: mine, error: mineErr } = await sb
        .from('records')
        .select('value')
        .eq('key', key)
        .eq('user_id', state.session.user.id)
        .maybeSingle();
      if (mineErr){ console.error('my-rank fetch failed:', mineErr.message); return null; }
      if (!mine) return { played: false };

      let q = sb.from('records').select('user_id', { count: 'exact', head: true }).eq('key', key);
      q = higherIsBetter ? q.gt('value', mine.value) : q.lt('value', mine.value);
      const { count, error: countErr } = await q;
      if (countErr){ console.error('my-rank count failed:', countErr.message); return { played: true, value: mine.value, rank: null }; }
      return { played: true, value: mine.value, rank: (count || 0) + 1 };
    },
    // Combo rows: the leaderboard sorts by one key (scoreKey) but displays value(s) from
    // other key(s) belonging to the same players — e.g. a hidden composite rank score
    // alongside the accuracy% and speed(ms) that produced it, or Flash Reflex's rounds
    // survived alongside its fastest-flash time. The `records` table has one row per
    // (user, key), so there's no single query that joins these — fetch the ranked key,
    // then fetch the extra keys filtered to just those user_ids, and stitch by user_id.
    async fetchComboTop(scoreKey, extraKeys, higherIsBetter, limit){
      const { data: scores, error } = await sb
        .from('records')
        .select('user_id, value, profiles(username)')
        .eq('key', scoreKey)
        .order('value', { ascending: !higherIsBetter })
        .limit(limit || 20);
      if (error){ console.error('combo leaderboard fetch failed:', error.message); return []; }
      if (!scores.length) return [];

      const ids = scores.map(s => s.user_id);
      const extraMaps = {};
      await Promise.all(extraKeys.map(async (k) => {
        const { data, error: exErr } = await sb.from('records').select('user_id, value').eq('key', k).in('user_id', ids);
        if (exErr){ console.error('combo extra-key fetch failed:', exErr.message); extraMaps[k] = {}; return; }
        extraMaps[k] = Object.fromEntries(data.map(r => [r.user_id, r.value]));
      }));

      return scores.map(s => ({
        username: (s.profiles && s.profiles.username) || 'Unknown',
        score: s.value,
        extra: Object.fromEntries(extraKeys.map(k => [k, extraMaps[k][s.user_id]]))
      }));
    },
    // Same idea as fetchMyRank, but also pulls the signed-in player's own values for the
    // extra keys so their collapsed row can show the full combo, not just the score.
    async fetchMyCombo(scoreKey, extraKeys, higherIsBetter){
      const mine = await this.fetchMyRank(scoreKey, higherIsBetter);
      if (!mine || !mine.played) return mine;

      const extra = {};
      await Promise.all(extraKeys.map(async (k) => {
        const { data, error } = await sb.from('records').select('value').eq('key', k).eq('user_id', state.session.user.id).maybeSingle();
        if (error){ console.error('my-combo extra-key fetch failed:', error.message); extra[k] = null; return; }
        extra[k] = data ? data.value : null;
      }));
      return { ...mine, extra };
    }
  };

  // onAuthStateChange fires once immediately on subscribe with the session already restored
  // from storage (event 'INITIAL_SESSION'), so a separate getSession() call would just race
  // this one and fire everything (pull, toast, modal-close) twice on every page load where
  // the player is already signed in. This single subscription is the only source of truth.
  sb.auth.onAuthStateChange((event, session) => {
    state.session = session;
    state.ready = true;
    if (event === 'PASSWORD_RECOVERY') recoveryListeners.forEach(fn => fn());
    if (event === 'SIGNED_IN') signedInListeners.forEach(fn => fn());
    if (session) pullAndMerge(session);
    notify();
  });
})();
