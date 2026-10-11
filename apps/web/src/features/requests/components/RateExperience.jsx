import { useCallback, useState } from 'react'
import Button from '../../../components/Button.jsx'
import { TextField } from '../../../components/FormField.jsx'
import Modal from '../../../components/Modal.jsx'
import Notice from '../../../components/Notice.jsx'
import { useToast } from '../../../components/Toast/ToastContext.js'
import { formatDate } from '../../../utils/formatDate.js'
import { EDIT_WINDOW_HOURS, REVIEW_CRITERIA } from '../constants.js'
import { useReviewsQuery, useReviewsService } from '../ReviewsContext.js'
import { COMMENT_MAX_LENGTH, ReviewError } from '../reviewsService.js'
import { StarInput, StarRating } from './Stars.jsx'
import styles from './RateExperience.module.css'

// "Rate your experience" for one completed request the user sent (or one of their parts orders): a
// prompt that opens the review form, the review they already left (editable for 48 hours), or a
// note that the 30 days are over. Shown in the chat, on the report and on the order. Renders nothing
// until the sender confirmed the work (the chat shows "Confirm completed" first) and for anyone who
// may not review - the reviews service decides.
export default function RateExperience({ request, compact = false }) {
  const loadStatus = useCallback((service) => service.getReviewStatus(request.id), [request.id])
  const { data: status, loading } = useReviewsQuery(loadStatus)
  const [open, setOpen] = useState(false)

  if (loading || !status || status.state === 'none' || status.state === 'unconfirmed') return null
  if (status.state === 'closed') {
    return <p className={styles.done}>The review period for this request ended on {formatDate(status.closesAt)}.</p>
  }

  const { state, review } = status
  const close = () => setOpen(false)

  return (
    <>
      {state === 'reviewed' ? (
        <div className={styles.mine}>
          <div className={styles.done}>
            <span>Your review:</span> <StarRating value={review.rating} />
            {review.comment && !compact && <q className={styles.comment}>{review.comment}</q>}
          </div>
          {review.hiddenReason && (
            <Notice tone="warning">MOTEXA hid your review from the public pages: {review.hiddenReason}</Notice>
          )}
          {status.canEdit ? (
            <div className={styles.editRow}>
              <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
                Edit review
              </Button>
              <span className={styles.hint}>You can edit it until {formatDate(status.editUntil)}.</span>
            </div>
          ) : (
            <span className={styles.hint}>Reviews can be edited for {EDIT_WINDOW_HOURS} hours, so this one is locked.</span>
          )}
        </div>
      ) : (
        <div className={styles.prompt}>
          <div>
            <p className={styles.title}>Rate your experience</p>
            <p className={styles.text}>
              How was {request.target.name}? Your review helps other customers choose. You can review until{' '}
              {formatDate(status.closesAt)}.
            </p>
          </div>
          <Button onClick={() => setOpen(true)}>Leave a review</Button>
        </div>
      )}
      <Modal open={open} title={`${review ? 'Edit your review of' : 'Review'} ${request.target.name}`} onClose={close} wide>
        <ReviewForm requestId={request.id} targetType={status.targetType} initial={review} onDone={close} onCancel={close} />
      </Modal>
    </>
  )
}

function ReviewForm({ requestId, targetType, initial, onDone, onCancel }) {
  const service = useReviewsService()
  const toast = useToast()
  const criteria = REVIEW_CRITERIA[targetType]
  const [rating, setRating] = useState(initial?.rating ?? 0)
  const [aspects, setAspects] = useState(initial?.aspects ?? {})
  const [comment, setComment] = useState(initial?.comment ?? '')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)

  const fail = (field, message) => {
    setErrors({ [field]: message })
    requestAnimationFrame(() => document.getElementById(field === 'rating' ? 'review-rating' : `review-${field.replace('.', '-')}`)?.focus())
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError(null)
    setSaving(true)
    try {
      const entry = { rating, aspects, comment }
      if (initial) await service.updateReview(initial.id, entry)
      else await service.createReview(requestId, entry)
      toast.success(initial ? 'Your review is updated.' : 'Thanks! Your review is on their public profile.')
      onDone()
    } catch (error) {
      if (error instanceof ReviewError && error.field) fail(error.field, error.message)
      else setFormError(error.message)
      setSaving(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <StarInput
        id="review-rating"
        label="Overall"
        value={rating}
        onChange={(stars) => {
          setRating(stars)
          setErrors({})
        }}
        error={errors.rating}
      />
      {criteria.map(({ key, label }) => (
        <StarInput
          key={key}
          id={`review-aspects-${key}`}
          label={label}
          value={aspects[key] ?? 0}
          onChange={(stars) => {
            setAspects((current) => ({ ...current, [key]: stars }))
            setErrors({})
          }}
          error={errors[`aspects.${key}`]}
        />
      ))}
      <TextField
        id="review-comment"
        as="textarea"
        label="Comment"
        optional
        hint={`What went well, what could be better. Shown publicly with your name. ${comment.length}/${COMMENT_MAX_LENGTH}`}
        rows={4}
        maxLength={COMMENT_MAX_LENGTH}
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        error={errors.comment}
      />
      {!initial && <p className={styles.hint}>You can edit your review for {EDIT_WINDOW_HOURS} hours after posting it.</p>}
      {formError && <Notice tone="danger">{formError}</Notice>}
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Post review'}
        </Button>
      </div>
    </form>
  )
}
