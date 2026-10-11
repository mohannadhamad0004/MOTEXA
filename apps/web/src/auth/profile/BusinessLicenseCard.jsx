import { useState } from 'react'
import Button from '../../components/Button.jsx'
import FilePreview from '../../components/FilePreview.jsx'
import FileUpload from '../../components/FileUpload.jsx'
import { useToast } from '../../components/Toast/ToastContext.js'
import { ROLES } from '../../authorization/roles.js'
import { REVIEW_STATUS } from '../constants.js'
import { changeOf } from '../reviewItems.js'
import { useAuth, useProfileService } from '../useAuth.js'
import ChangeStatusNotice from './ChangeStatusNotice.jsx'
import styles from './ProfileForms.module.css'

// Parts shops and tow companies: the business license on file, and uploading a new one. A new
// license goes to an admin; the current one stays on file until it is approved. Never public.
export default function BusinessLicenseCard() {
  const { user } = useAuth()
  const service = useProfileService()
  const toast = useToast()
  const [file, setFile] = useState(null)
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)

  const change = changeOf(user, 'businessLicense')
  const pending = change?.status === REVIEW_STATUS.PENDING
  const label = user.role === ROLES.PARTS_SHOP ? 'Business license / commercial registration' : 'Business license'

  async function send() {
    if (!file) {
      setError('Choose the new license file first.')
      return
    }
    setSending(true)
    setError(null)
    try {
      await service.submitBusinessLicense(file)
      setFile(null)
      toast.success('Your new license was sent to MOTEXA for review.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={styles.form}>
      <div className={styles.field}>
        <p className={styles.muted}>Current {label.toLowerCase()} (approved)</p>
        {user.businessLicense ? <FilePreview file={user.businessLicense} /> : <p className={styles.muted}>None on file.</p>}
      </div>

      <ChangeStatusNotice change={change}>
        {change && (
          <div className={styles.field}>
            <p>New file:</p>
            <FilePreview file={change.value} />
          </div>
        )}
      </ChangeStatusNotice>

      <FileUpload
        id="businessLicense"
        label={pending ? 'Replace the license waiting for review' : 'Upload a new license'}
        hint="E.g. when it was renewed. MOTEXA checks it before it replaces the current one."
        kind="document"
        value={file}
        onChange={(next) => {
          setFile(next)
          setError(null)
        }}
        error={error}
      />
      <div className={styles.actions}>
        <Button variant="secondary" onClick={send} loading={sending} disabled={!file}>
          {sending ? 'Sending…' : 'Send for review'}
        </Button>
      </div>
    </div>
  )
}
