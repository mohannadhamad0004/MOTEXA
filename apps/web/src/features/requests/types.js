// JSDoc type definitions for the requests feature.

/**
 * @typedef {Object} CarDetails
 * @property {string} make
 * @property {string} model
 * @property {number} year
 */

/**
 * @typedef {Object} Request
 * @property {string} id
 * @property {'service' | 'tow' | 'part_question'} type
 * @property {'pending' | 'in_progress' | 'completed'} status
 * @property {string} createdAt   ISO date
 * @property {{ id: string, role: 'customer' | 'mechanic', name: string }} sender
 * @property {{ id: string, type: 'mechanic' | 'tow' | 'parts_shop', name: string, partName?: string }} target
 * @property {string} [assignedTruckId]  tow: the company's truck on this job
 * @property {string} [arrivedAt]           tow: ISO date the company marked "Arrived" (needed to complete)
 * @property {string} [customerConfirmedAt] ISO date the sender confirmed the provider's completion; reviews open then
 * @property {string} [disputedAt]          ISO date the sender said "This didn't happen"; flagged for admins
 * @property {Object} details
 *   service:       { mode: ServiceMode, car: CarDetails | null, carId?: string, problem: string,
 *                    media: File[], location?: string (on_site),
 *                    preferredAt?: string (workshop, "YYYY-MM-DDTHH:mm"),
 *                    diagnosis?: AttachedDiagnosis }
 *                  online consultations have no car; carId is set when it is one of the customer's
 *                  cars (/my-cars), for its maintenance history
 *   tow:           { pickup: string, pickupPosition?: { lat, lng } (the pin the customer confirmed),
 *                    destination: string, destinationType?: 'mechanic' | 'shop', destinationId?: string,
 *                    car: CarDetails, carId?: string, problemType: TowProblemType, note: string }
 *   part_question: { partId: string, message: string, quantity: number }
 * @property {{ orderId: string, checkoutNumber: string, shopName: string, name: string, quantity: number, priceIls: number }[]} [purchasedParts]
 *   service: parts the mechanic bought through MOTEXA for this request (features/marketplace orders)
 * @property {Completion} [completion]  set when the provider marks the request completed
 *   (completion.completedAt is the request's completedAt)
 */

/**
 * The AI report a customer sent with a service request (a copy, without the media file).
 * @typedef {Omit<import('../diagnosis/types.js').Diagnosis, 'userId' | 'file'>} AttachedDiagnosis
 */

/**
 * What the mechanic, tow company or shop entered when finishing the job.
 * @typedef {Object} Completion
 * @property {string} completedAt   ISO date
 * @property {string} [confirmedDiagnosis]  service: what the mechanic found
 * @property {string} [workDone]            service
 * @property {{ name: string, quantity: number, priceIls: number }[]} [partsUsed]  service
 * @property {number} [laborIls]            service
 * @property {{ id: string, plateNumber: string, type: string }} [truck]  tow
 * @property {number} totalIls              what the customer paid (service: parts + labor)
 * @property {string} [note]                part questions: e.g. "Picked up 4 discs"
 */

/**
 * A review of the mechanic, tow company or shop of one completed and confirmed request, written by
 * the sender of the request. Ratings of a provider are always calculated from these records.
 * @typedef {Object} Review
 * @property {string} id
 * @property {string} requestId     one review per request (or the id of a parts order)
 * @property {string} targetId      the reviewed account (mechanic, tow company, shop id)
 * @property {'mechanic' | 'tow' | 'parts_shop'} targetType
 * @property {string} targetName
 * @property {string} customerId    the reviewer (a customer, or a mechanic for a part question)
 * @property {string} customerName
 * @property {1 | 2 | 3 | 4 | 5} rating  overall
 * @property {Object<string, 1 | 2 | 3 | 4 | 5>} aspects  the three detailed ratings by key (REVIEW_CRITERIA in
 *   constants.js): mechanic quality / price / communication, tow arrival / care / professionalism,
 *   parts shop match / price / communication (database columns rating_1, rating_2, rating_3)
 * @property {string} comment       may be empty, at most 1000 characters
 * @property {string} serviceLabel  "Workshop visit · Brakes", "Tow · Nablus → Ramallah", "Part · Brake pads"
 * @property {string} createdAt     ISO date; the reviewer can edit for 48 hours after it
 * @property {string | null} editedAt
 * @property {{ text: string, createdAt: string, editedAt: string | null } | null} reply  the reviewed party's public reply
 * @property {{ reason: string, hiddenAt: string, hiddenBy: string } | null} [hidden]
 *   set by an admin; the public never sees this field (the reviewer sees the reason as `hiddenReason`)
 */

/**
 * A report of a review by a logged-in user (table review_reports).
 * @typedef {Object} ReviewReport
 * @property {string} id
 * @property {string} reviewId
 * @property {string} reporterId
 * @property {string} reporterName
 * @property {'spam' | 'abusive' | 'fake' | 'not_about_provider'} reason
 * @property {string} details
 * @property {'open' | 'dismissed' | 'actioned'} status
 * @property {string} createdAt
 */

/**
 * A chat message. Every request has one chat between its sender and the provider.
 * @typedef {Object} ChatMessage
 * @property {string} id
 * @property {string} requestId
 * @property {string} senderId
 * @property {string} text      may be empty when photos are attached
 * @property {File[]} photos
 * @property {string} createdAt ISO date
 */

/** @typedef {'on_site' | 'workshop' | 'online'} ServiceMode  SERVICE_MODES in auth/signup/constants.js */

export {}
