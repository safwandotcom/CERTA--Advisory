'use client'

import { useActionState, useRef } from 'react'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import {
  saveOrSubmitOnboardingAction,
  uploadOnboardingDocumentAction,
  type OnboardingActionState,
} from './actions'
import { card, input, label as labelClass, buttonPrimary, buttonGhost, errorText, successText } from '@/lib/ui'
import type { EmployeeOnboarding } from '@/lib/onboarding'

const PERSONAL_DETAILS_FORM_ID = 'onboarding-personal-details-form'

const initialState: OnboardingActionState = {}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

function FormMessage({ state }: { state: OnboardingActionState }) {
  if (state.error) {
    return (
      <p role="alert" className={`${errorText} mt-4`}>
        <AlertCircle size={16} strokeWidth={2} className="shrink-0" />
        {state.error}
      </p>
    )
  }
  if (state.success) {
    return (
      <p className={`${successText} mt-4`}>
        <CheckCircle2 size={16} strokeWidth={2} className="shrink-0" />
        {state.success}
      </p>
    )
  }
  return null
}

function DocumentUpload({
  slot,
  title,
  currentUrl,
}: {
  slot: 'national_id' | 'offer_letter' | 'photo'
  title: string
  currentUrl: string | null
}) {
  const [state, action, isPending] = useActionState(uploadOnboardingDocumentAction.bind(null, slot), initialState)
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <div className="rounded-[10px] border border-border p-4">
      <p className="text-[0.8125rem] font-semibold text-ink">{title}</p>
      {currentUrl && (
        <a
          href={currentUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-[0.8125rem] font-semibold text-certa-green-deep hover:underline"
        >
          View current file
        </a>
      )}
      <form ref={formRef} action={action} className="mt-3 flex flex-wrap items-center gap-3">
        {/* Submits itself the moment a file is chosen -- no separate Upload
            button to click per document, which was confusing candidates. */}
        <input
          name="file"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          required
          disabled={isPending}
          onChange={() => formRef.current?.requestSubmit()}
          className={`${input} max-w-xs file:mr-3 file:rounded-[6px] file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-[0.8125rem] file:font-semibold file:text-ink disabled:opacity-60`}
        />
        {isPending && (
          <span className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink-muted">
            <Loader2 size={15} strokeWidth={2} className="animate-spin" />
            Uploading…
          </span>
        )}
      </form>
      <FormMessage state={state} />
    </div>
  )
}

export default function OnboardingForm({
  onboarding,
  documentUrls,
  correctionNote,
}: {
  onboarding: EmployeeOnboarding | null
  documentUrls: { nationalId: string | null; offerLetter: string | null; photo: string | null }
  correctionNote: string | null
}) {
  const [state, formAction] = useActionState(saveOrSubmitOnboardingAction, initialState)

  return (
    <div className="flex flex-col gap-6">
      {correctionNote && (
        <div className={`${card} border border-signal-coral`}>
          <p className="text-[0.8125rem] font-semibold text-signal-coral-deep">
            Your submission needs a correction
          </p>
          <p className="mt-1 text-[0.9375rem] text-ink">{correctionNote}</p>
        </div>
      )}

      <form id={PERSONAL_DETAILS_FORM_ID} action={formAction} className={card}>
        <h2 className="font-display text-base font-semibold text-ink">Personal details</h2>
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="dateOfBirth" className={labelClass}>Date of birth</label>
            <input id="dateOfBirth" name="dateOfBirth" type="date" required defaultValue={onboarding?.date_of_birth ?? ''} className={input} />
          </div>
          <div>
            <label htmlFor="fathersName" className={labelClass}>Father&apos;s name</label>
            <input id="fathersName" name="fathersName" required defaultValue={onboarding?.fathers_name ?? ''} className={input} />
          </div>
          <div>
            <label htmlFor="mothersName" className={labelClass}>Mother&apos;s name</label>
            <input id="mothersName" name="mothersName" required defaultValue={onboarding?.mothers_name ?? ''} className={input} />
          </div>
          <div>
            <label htmlFor="bloodGroup" className={labelClass}>Blood group</label>
            <select id="bloodGroup" name="bloodGroup" required defaultValue={onboarding?.blood_group ?? ''} className={input}>
              <option value="">Select blood group</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="phone" className={labelClass}>Phone number</label>
            <input id="phone" name="phone" required defaultValue={onboarding?.phone ?? ''} className={input} />
          </div>
          <div>
            <label htmlFor="personalEmail" className={labelClass}>Personal email</label>
            <input id="personalEmail" name="personalEmail" type="email" required defaultValue={onboarding?.personal_email ?? ''} className={input} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="presentAddress" className={labelClass}>Present address</label>
            <textarea id="presentAddress" name="presentAddress" required rows={2} defaultValue={onboarding?.present_address ?? ''} className={input} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="permanentAddress" className={labelClass}>Permanent address</label>
            <textarea id="permanentAddress" name="permanentAddress" required rows={2} defaultValue={onboarding?.permanent_address ?? ''} className={input} />
          </div>
        </div>

        <h2 className="mt-8 font-display text-base font-semibold text-ink">Emergency contact</h2>
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="emergencyContactName" className={labelClass}>Contact name</label>
            <input id="emergencyContactName" name="emergencyContactName" required defaultValue={onboarding?.emergency_contact_name ?? ''} className={input} />
          </div>
          <div>
            <label htmlFor="emergencyContactRelationship" className={labelClass}>Relationship</label>
            <input id="emergencyContactRelationship" name="emergencyContactRelationship" required defaultValue={onboarding?.emergency_contact_relationship ?? ''} className={input} />
          </div>
          <div>
            <label htmlFor="emergencyContactPhone" className={labelClass}>Contact phone number</label>
            <input id="emergencyContactPhone" name="emergencyContactPhone" required defaultValue={onboarding?.emergency_contact_phone ?? ''} className={input} />
          </div>
        </div>

        <h2 className="mt-8 font-display text-base font-semibold text-ink">Bank details</h2>
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="bankName" className={labelClass}>Bank name</label>
            <input id="bankName" name="bankName" required defaultValue={onboarding?.bank_name ?? ''} className={input} />
          </div>
          <div>
            <label htmlFor="accountHolderName" className={labelClass}>Account holder name</label>
            <input id="accountHolderName" name="accountHolderName" required defaultValue={onboarding?.account_holder_name ?? ''} className={input} />
          </div>
          <div>
            <label htmlFor="accountNumber" className={labelClass}>Account number</label>
            <input id="accountNumber" name="accountNumber" required defaultValue={onboarding?.account_number ?? ''} className={input} />
          </div>
          <div>
            <label htmlFor="branchCode" className={labelClass}>Branch / routing code</label>
            <input id="branchCode" name="branchCode" required defaultValue={onboarding?.branch_code ?? ''} className={input} />
          </div>
        </div>
      </form>

      <div className={`${card} flex flex-col gap-4`}>
        <h2 className="font-display text-base font-semibold text-ink">Documents</h2>
        <DocumentUpload slot="national_id" title="National ID copy" currentUrl={documentUrls.nationalId} />
        <DocumentUpload slot="offer_letter" title="Signed offer letter" currentUrl={documentUrls.offerLetter} />
        <DocumentUpload slot="photo" title="Passport-size photo" currentUrl={documentUrls.photo} />
      </div>

      {/* Save progress / Submit for review live here, after Documents, so
          the page reads in the order candidates actually need to complete
          it -- but both buttons still submit the Personal details form
          above via the `form` attribute, not a form of their own. */}
      <div className={card}>
        <FormMessage state={state} />
        <div className={`flex flex-wrap gap-3${state.error || state.success ? ' mt-4' : ''}`}>
          <button
            type="submit"
            form={PERSONAL_DETAILS_FORM_ID}
            name="intent"
            value="save"
            formNoValidate
            className={buttonGhost}
          >
            Save progress
          </button>
          <button type="submit" form={PERSONAL_DETAILS_FORM_ID} name="intent" value="submit" className={buttonPrimary}>
            Submit for review
          </button>
        </div>
      </div>
    </div>
  )
}
