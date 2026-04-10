import './SecurityMascot.css'

/**
 * Security buddy: eyes follow the field you're typing in;
 * eyes close on password so it feels private and relatable.
 */
export function SecurityMascot({ focusedField = null, context = 'auth' }) {
  const isPassword = focusedField === 'password'
  const isEmailOrUser = focusedField === 'email' || focusedField === 'username'

  const hints = {
    auth: {
      idle: "I'm your security buddy — here whenever you need.",
      email: "Checking it's you. I never look at your password.",
      username: "Checking it's you. I never look at your password.",
      password: "Eyes closed. Your password stays between you and the app.",
    },
    login: {
      idle: "Signing in? I'm here to keep it secure.",
      email: "Your sign-in email or username — I only use it to verify it's you.",
      username: "Your sign-in email or username — I only use it to verify it's you.",
      password: "Eyes closed. Your sign-in password stays private.",
    },
    register: {
      idle: "Creating your account? I'm here so it stays secure.",
      email: "Your account email — used only to secure and recover your account.",
      username: "Your username — how you'll sign in. Passwords stay hidden.",
      password: "Eyes closed. Your new password is hashed — I never see or store it plain.",
    },
  }
  const set = hints[context] || hints.auth
  const hint = isPassword
    ? set.password
    : focusedField === 'email'
      ? set.email
      : focusedField === 'username'
        ? set.username
        : isEmailOrUser
          ? set.email
          : set.idle

  return (
    <div className="security-mascot" role="img" aria-label="Security assistant">
      <div className="mascot-face">
        {isPassword ? (
          <div className="mascot-eyes-closed">
            <span className="mascot-eye-cover" />
            <span className="mascot-eye-cover" />
          </div>
        ) : (
          <div className="mascot-eyes">
            <span
              className="mascot-eye"
              style={{
                transform: isEmailOrUser ? 'translateX(-3px)' : focusedField ? 'translateX(3px)' : 'none',
              }}
            >
              <span className="mascot-pupil" />
            </span>
            <span
              className="mascot-eye"
              style={{
                transform: isEmailOrUser ? 'translateX(-3px)' : focusedField ? 'translateX(3px)' : 'none',
              }}
            >
              <span className="mascot-pupil" />
            </span>
          </div>
        )}
        <span className="mascot-smile" aria-hidden />
      </div>
      <p className="mascot-hint">{hint}</p>
    </div>
  )
}
