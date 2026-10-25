(function () {
  var db = window.supabase.createClient(window.APP_CONFIG.supabaseUrl, window.APP_CONFIG.supabaseKey);
  var views = ["view-login", "view-enroll", "view-verify", "view-dashboard"];
  var pendingFactorId = null;

  function $(id) {
    return document.getElementById(id);
  }

  function show(id) {
    views.forEach(function (view) {
      $(view).hidden = view !== id;
    });
  }

  function setStatus(message, isError) {
    $("status").textContent = message || "";
    $("status").classList.toggle("error", !!isError);
  }

  function fail(error) {
    setStatus((error && error.message) || "Terjadi kesalahan. Coba lagi.", true);
  }

  // Supabase mengirim QR sebagai SVG mentah atau data URL; keduanya dibuat bisa dipakai di <img>.
  function qrSrc(qr) {
    return qr.indexOf("<") === 0 ? "data:image/svg+xml;utf8," + encodeURIComponent(qr) : qr;
  }

  async function route() {
    setStatus("");
    var sessionResult = await db.auth.getSession();
    var session = sessionResult.data.session;
    if (!session) {
      show("view-login");
      return;
    }

    var aalResult = await db.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalResult.error) return fail(aalResult.error);

    var aal = aalResult.data;
    if (aal.currentLevel === "aal2") return enterDashboard(session.user);
    if (aal.nextLevel === "aal2") return show("view-verify");
    return startEnroll();
  }

  async function enterDashboard(user) {
    var result = await db.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (result.error) return fail(result.error);

    if (!result.data) {
      setStatus("Akun ini tidak terdaftar sebagai admin.", true);
      await db.auth.signOut();
      show("view-login");
      return;
    }

    $("admin-email").textContent = user.email;
    show("view-dashboard");
    loadCounts();
  }

  async function loadCounts() {
    var tables = {
      games: "count-games",
      news: "count-news",
      changelog: "count-changelog",
      game_downloads: "count-downloads"
    };

    for (var table in tables) {
      var result = await db.from(table).select("*", { count: "exact", head: true });
      $(tables[table]).textContent = result.error ? "Error" : String(result.count);
    }
  }

  async function startEnroll() {
    var listResult = await db.auth.mfa.listFactors();
    if (listResult.error) return fail(listResult.error);

    // Hapus pendaftaran authenticator yang belum selesai supaya tidak menumpuk.
    for (var factor of listResult.data.all) {
      if (factor.factor_type === "totp" && factor.status === "unverified") {
        await db.auth.mfa.unenroll({ factorId: factor.id });
      }
    }

    var enrollResult = await db.auth.mfa.enroll({ factorType: "totp", friendlyName: "Admin" });
    if (enrollResult.error) return fail(enrollResult.error);

    pendingFactorId = enrollResult.data.id;
    $("enroll-qr").src = qrSrc(enrollResult.data.totp.qr_code);
    $("enroll-secret").textContent = enrollResult.data.totp.secret;
    show("view-enroll");
  }

  $("form-login").addEventListener("submit", async function (event) {
    event.preventDefault();
    setStatus("Memproses...");

    var result = await db.auth.signInWithPassword({
      email: $("login-email").value.trim(),
      password: $("login-password").value
    });
    $("login-password").value = "";

    if (result.error) return fail(result.error);
    route();
  });

  $("form-enroll").addEventListener("submit", async function (event) {
    event.preventDefault();

    var result = await db.auth.mfa.challengeAndVerify({
      factorId: pendingFactorId,
      code: $("enroll-code").value.trim()
    });
    if (result.error) return fail(result.error);

    $("enroll-code").value = "";
    route();
  });

  $("form-verify").addEventListener("submit", async function (event) {
    event.preventDefault();

    var listResult = await db.auth.mfa.listFactors();
    if (listResult.error) return fail(listResult.error);

    var factor = listResult.data.totp.find(function (item) {
      return item.status === "verified";
    });
    if (!factor) return route();

    var result = await db.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code: $("verify-code").value.trim()
    });
    if (result.error) return fail(result.error);

    $("verify-code").value = "";
    route();
  });

  $("btn-logout").addEventListener("click", async function () {
    await db.auth.signOut();
    route();
  });

  route();
})();
