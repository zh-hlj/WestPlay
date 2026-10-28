// WestPlay, in Bilibili's sign-in window (signin.rs): www.bilibili.com's own page, where signing in is its own
// dialog (a QR code scanned with the Bilibili app). Its own "登录" is pressed, and once its nav says signed in
// this says it, nothing of the account but that.
;;(() => {
  if (location.hostname !== 'www.bilibili.com' || window.top !== window) return
  const post = (message) => window.chrome?.webview?.postMessage(message)
  const UNTIL = Date.now() + 10 * 60 * 1000
  const cookie = (name) => {
    const found = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
    return found ? found[1] : ''
  }
  const signedIn = async () => {
    if (cookie('SESSDATA')) return true
    try {
      const response = await fetch('https://api.bilibili.com/x/web-interface/nav', {
        credentials: 'include',
        headers: { Referer: 'https://www.bilibili.com/' },
      })
      if (!response.ok) return false
      const answer = await response.json()
      return Boolean(answer?.data?.isLogin)
    } catch {
      return false
    }
  }
  const SIGN_IN = '.header-login-entry, .bili-login, [data-module="login"], .go-login-btn'
  let said = false
  let pressed = false
  const say = (left = 3) => {
    post({ signedIn: true })
    if (left > 1) setTimeout(() => say(left - 1), 300)
  }
  const look = async () => {
    if (said) return
    if (await signedIn()) {
      said = true
      say()
      return
    }
    if (Date.now() > UNTIL) return
    const button = document.querySelector(SIGN_IN)
    if (button && !pressed) {
      pressed = true
      button.click()
    }
    setTimeout(look, 600)
  }
  look()
})()
