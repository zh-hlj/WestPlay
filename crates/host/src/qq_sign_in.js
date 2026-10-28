// WestPlay, in QQ Music's sign-in window (signin.rs): y.qq.com's own page, where signing in is its own dialog (a
// QR code scanned with QQ Music's phone app). The page's own "登录" is pressed, and once its cookies say signed in
// this says it, nothing of the account but that.
;;(() => {
  if (location.hostname !== 'y.qq.com' || window.top !== window) return
  const post = (message) => window.chrome?.webview?.postMessage(message)
  const UNTIL = Date.now() + 10 * 60 * 1000
  const cookie = (name) => {
    const found = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
    return found ? found[1] : ''
  }
  // Signed in: its uin cookie (qm_keyst may be HttpOnly, so not read here), or the page's own account picture.
  const signedIn = () => {
    if (cookie('uin') || cookie('qqmusic_uin') || cookie('p_uin')) return true
    return Boolean(document.querySelector('.top_login__name, .u-face, .yqq-header .pic, .header-avatar'))
  }
  const SIGN_IN = '.top_login__link, .js_login, [data-stat="login"], a[href*="login.qq.com"]'
  let said = false
  let pressed = false
  const say = (left = 3) => {
    post({ signedIn: true })
    if (left > 1) setTimeout(() => say(left - 1), 300)
  }
  const look = () => {
    if (said) return
    if (signedIn()) {
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
    setTimeout(look, 500)
  }
  look()
})()
