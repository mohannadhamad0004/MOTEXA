import { lazy, Suspense, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import Button from '../components/Button.jsx'
import { TextField } from '../components/FormField.jsx'
import Notice from '../components/Notice.jsx'
import { AuthError } from './authService.js'
import { ACCOUNT_STATUS } from './constants.js'
import { landingPathFor } from './landingPath.js'
import { safeRedirect } from './redirect.js'
import { useAuth } from './useAuth.js'
import { isValidEmail } from './validation.js'
import AuthCard from './AuthCard.jsx'
import PasswordInput from './PasswordInput.jsx'
import styles from './LoginPage.module.css'

// Development only: one-click test logins. Vite replaces import.meta.env.DEV with `false` in
// production builds, so this becomes `null` and the panel's code is never bundled.
const DevLoginPanel = import.meta.env.DEV ? lazy(() => import('./dev/DevLoginPanel.jsx')) : null

function validate({ email, password }) {
  const errors = {}
  if (!email.trim()) errors.email = 'Enter your email address.'
  else if (!isValidEmail(email)) errors.email = 'Enter a valid email address, like name@example.com.'
  if (!password) errors.password = 'Enter your password.'
  return errors
}

// /login?redirect=/some/page - after logging in, users go back to `redirect` (the page they were
// on, e.g. when they clicked "Request service"), otherwise to their landing page: home for
// customers, the dashboard for other roles. Accounts waiting for approval go to /pending-approval.
export default function LoginPage() {
  const { user, service } = useAuth()
  const [searchParams] = useSearchParams()
  const redirect = safeRedirect(searchParams.get('redirect'))
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    const target = user.status === ACCOUNT_STATUS.APPROVED && redirect ? redirect : landingPathFor(user)
    return <Navigate to={target} replace />
  }

  const setField = (name) => (event) => {
    const { value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    if (errors[name]) setErrors((current) => ({ ...current, [name]: undefined }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError(null)
    const found = validate(form)
    setErrors(found)
    const [firstInvalid] = Object.keys(found)
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus()
      return
    }

    setSubmitting(true)
    try {
      await service.login(form.email, form.password)
      // The user is now in AuthContext, so the next render redirects.
    } catch (error) {
      setFormError(error instanceof AuthError ? error.message : "Couldn't log you in. Please try again.")
      setSubmitting(false)
    }
  }

  return (
    <AuthCard
      title="Log in"
      subtitle={redirect ? "Log in and we'll take you back to where you were." : 'Welcome back to MOTEXA.'}
      footer={
        <>
          New to MOTEXA? <Link to="/signup">Create an account</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {formError && <Notice tone="danger">{formError}</Notice>}
        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={setField('email')}
          error={errors.email}
        />
        <div className={styles.passwordGroup}>
          <TextField
            id="password"
            as={PasswordInput}
            label="Password"
            autoComplete="current-password"
            value={form.password}
            onChange={setField('password')}
            error={errors.password}
          />
          <Link to="/forgot-password" className={styles.forgot}>
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" loading={submitting} className={styles.submit}>
          {submitting ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
      {DevLoginPanel && (
        <Suspense fallback={null}>
          <DevLoginPanel />
        </Suspense>
      )}
    </AuthCard>
  )
}
