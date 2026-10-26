// WestPlay, in NetEase Cloud Music's sign-in window (signin.rs): NetEase's own page, where signing in is its
// own dialog, a QR code scanned with the phone's app. The window is for signing in: that dialog opened at once
// (the page's own "登录" pressed), and once the page is signed in (its own account says so) this says it,
// nothing more of the account.
;(() => {
  if (location.hostname !== 'music.163.com' || window.top !== window) return
  const post = (message) => window.chrome?.webview?.postMessage(message)
  const pageFetch = window.fetch.bind(window)
  // How long the page is looked at: signing in is the player's own, and may take as long as it takes.
  const UNTIL = Date.now() + 10 * 60 * 1000
  // TODO(verify): the old page's own "登录" (its sign-in dialog) and its top bar's account once signed in: the
  // page may change either (`#showLogin`, `.m-top .login`, `a[href*="/user/home"]`, `.m-top .user`).
  const SIGN_IN = '#showLogin, .m-top .login, [data-action="login"]'
  const SIGNED_IN = 'a[href*="/user/home"], .m-top .user, .m-top .m-user'
  let said = false
  // Says it (again, a moment apart: never more than three times): the sign-in window's host took it the first
  // time, and its page is closed then.
  const say = (left = 3) => {
    post({ signedIn: true })
    if (left > 1) setTimeout(() => say(left - 1), 300)
  }
  const signedIn = async () => {
    try {
      // TODO(verify): the page's own account request, signed by its cookies: `{account: null}` signed out.
      const response = await pageFetch('/api/nuser/account/get', { credentials: 'same-origin' })
      if (response.ok) {
        const json = await response.json()
        if (json?.account) return true
      }
    } catch {
      // Not answering: the page's own top bar may.
    }
    return Boolean(document.querySelector(SIGNED_IN))
  }
  let pressed = false
  const look = async () => {
    if (said) return
    if (await signedIn()) {
      said = true
      say()
      return
    }
    if (Date.now() > UNTIL) return
    // The page's own "登录", pressed once it's there (again, should the page load anew).
    const button = document.querySelector(SIGN_IN)
    if (button && !pressed) {
      pressed = true
      button.click()
    }
    setTimeout(look, 500)
  }
  look()
})()
