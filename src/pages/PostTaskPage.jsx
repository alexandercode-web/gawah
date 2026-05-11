import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

const defaultCategoryNames = [
  'Errands',
  'Tutoring',
  'Delivery',
  'Moving',
  'Other',
]

const hiddenCategoryKeys = new Set(['cleaning', 'repairs', 'shopping'])

const errandTaskOptions = [
  'Paying bills',
  'Queueing',
  'Processing requests',
]

const tutoringYearOptions = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',

]

const campusLocationZones = [
  'Gate',
  'Library Area',
  'Canteen Area',
  'Annex Building',
  'Basic Ed Building',
  'CBA Building',
  'Maritime Building',
  'Cashier Area',
  'Registrar Area',
  'Sao Office Area',
  'Gym',
  'Other Campus Spot',
]

const campusGateNumbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9',]
const annexBuildingNumbers = ['1', '2']



function normalizeCategory(name) {
  return String(name || '').trim().toLowerCase()
}



function isPurchaseRelatedTask(categoryName, title, description) {
  const categoryKey = normalizeCategory(categoryName)
  return categoryKey.includes('delivery')
}



function PostTaskPage({ user, onSubmitTask, posting, hasUnreadNotifications = false, onLogout }) {
  // VERSION: 2.1.0-AUTO-PRICING
  const navigate = useNavigate()
  const navRef = useRef(null)
  const [error, setError] = useState('')
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: defaultCategoryNames[0],
    errandType: '',
    tutoringCourse: '',
    tutoringYear: '',
    movingType: '',
    itemName: '',
    itemQuantity: '1',
    locationZone: '',
    gateNumber: '',
    annexNumber: '',
    landmark: '',
    budget: '45',
    productPrice: '0',
    paymentMethod: 'Cash',
  })

  useEffect(() => {
    let active = true

    async function loadCategories() {
      try {
        const list = await api.listCategories()
        if (active && Array.isArray(list)) {
          setCategories(list)
        }
      } catch {
        // Keep local fallback categories if API category loading fails.
      }
    }

    loadCategories()

    return () => {
      active = false
    }
  }, [])

  // Automatic pricing logic
  const budgetDetails = useMemo(() => {
    const cat = normalizeCategory(form.category)
    let baseFee = 20
    let complexityFee = 5
    const prodPrice = Number(form.productPrice) || 0

    if (cat.includes('delivery')) {
      baseFee = 15
      complexityFee = 5 + (Number(form.itemQuantity) - 1) * 3
    } else if (cat.includes('tutor') || cat.includes('academic')) {
      baseFee = 50
      complexityFee = 20
      if (form.tutoringYear.includes('3') || form.tutoringYear.includes('4')) complexityFee += 15
    } else if (cat.includes('moving')) {
      baseFee = 70
      complexityFee = 30
    } else if (cat.includes('errand')) {
      baseFee = 20
      complexityFee = 10
      if (form.errandType === 'Queueing') complexityFee += 15
    } else if (cat.includes('laundry')) {
      baseFee = 30
      complexityFee = 15
    }

    // Special Student Discount for small errands
    if (prodPrice > 0 && prodPrice < 50) {
      baseFee = Math.max(10, baseFee - 5)
    }

    const serviceTotal = baseFee + complexityFee
    const protectionFee = Math.ceil((serviceTotal + prodPrice) * 0.05) // Student Rate: 5%
    const total = serviceTotal + prodPrice + protectionFee

    return { baseFee, complexityFee, prodPrice, protectionFee, total, isStudentRate: true }
  }, [form.category, form.itemQuantity, form.tutoringYear, form.errandType, form.productPrice])

  useEffect(() => {
    setForm(prev => ({ ...prev, budget: String(budgetDetails.total) }))
  }, [budgetDetails.total])

  // Automatic item pricing
  useEffect(() => {
    const item = form.itemName.trim().toLowerCase()
    const commonItems = {
      'pares': '55',
      'siomai rice': '45',
      'chicken meal': '125',
      'milk tea': '99',
      'corndog': '50',
      'burger': '35',
      'coke': '22',
      'water': '15',
      'school supplies': '45',
      'photocopy': '1',
      'print': '2',
      'scanning': '10',
      'laundry': '140',
      'medicine': '90',
    }

    const foundPrice = Object.entries(commonItems).find(([key]) => item.includes(key))?.[1]
    if (foundPrice) {
      setForm(prev => ({ ...prev, productPrice: foundPrice }))
    }
  }, [form.itemName])

  const isItemRecognized = useMemo(() => {
    const item = form.itemName.trim().toLowerCase()
    const keys = ['pares', 'siomai rice', 'chicken meal', 'milk tea', 'corndog', 'burger', 'coke', 'water', 'school supplies', 'photocopy', 'print', 'scanning', 'laundry', 'medicine']
    return keys.some(key => item.includes(key))
  }, [form.itemName])

  const categoryNames = useMemo(() => {
    const fromApi = categories
      .map((category) => category.CategoryName)
      .filter((name) => {
        const value = String(name || '').trim()
        if (value.length === 0) return false
        return !hiddenCategoryKeys.has(normalizeCategory(value))
      })

    const base = [...new Set([...defaultCategoryNames, ...fromApi])]
    return base.filter((name) => !hiddenCategoryKeys.has(normalizeCategory(name)))
  }, [categories])

  const isErrandsTask = normalizeCategory(form.category).includes('errand')
  const isTutoringTask = normalizeCategory(form.category).includes('tutor')
  const isMovingTask = normalizeCategory(form.category).includes('moving')
  const requiresSubLocationNumber = form.locationZone === 'Gate' || form.locationZone === 'Annex Building'
  const requiredFieldCount =
    (requiresSubLocationNumber ? 7 : 6) +
    (isErrandsTask ? 1 : 0) +
    (isTutoringTask ? 2 : 0) +
    (isMovingTask ? 1 : 0)

  const filledFields = useMemo(() => {
    const requiredValues = [
      form.title.trim(),
      form.description.trim(),
      form.category.trim(),
      form.locationZone,
      form.landmark.trim(),
      form.budget,
    ]

    if (form.locationZone === 'Gate') {
      requiredValues.push(form.gateNumber)
    } else if (form.locationZone === 'Annex Building') {
      requiredValues.push(form.annexNumber)
    }

    if (isErrandsTask) {
      requiredValues.push(form.errandType)
    }

    if (isTutoringTask) {
      requiredValues.push(form.tutoringCourse.trim(), form.tutoringYear)
    }

    if (isMovingTask) {
      requiredValues.push(form.movingType.trim())
    }

    return requiredValues.filter(Boolean).length
  }, [form, isErrandsTask, isTutoringTask, isMovingTask])

  const completionPercent = Math.round((filledFields / requiredFieldCount) * 100)
  const previewBudget = form.budget ? `P${Number(form.budget).toLocaleString()}` : 'Set a budget'
  const previewTitle = form.title.trim() || 'Your task title will appear here'
  const previewDescription = form.description.trim() || 'Add the task details so helpers know exactly what to do.'
  const isPurchaseTask = useMemo(
    () => isPurchaseRelatedTask(form.category, form.title, form.description),
    [form.category, form.title, form.description]
  )
  const itemQuantity = useMemo(() => {
    const parsed = Number.parseInt(String(form.itemQuantity || '').trim(), 10)
    if (!Number.isFinite(parsed) || parsed <= 0) return 1
    return Math.min(parsed, 99)
  }, [form.itemQuantity])
  const combinedLocation = useMemo(() => {
    const zone = form.locationZone.trim()
    const gate = form.gateNumber.trim()
    const annex = form.annexNumber.trim()
    const landmark = form.landmark.trim()
    const zoneLabel = zone === 'Gate' && gate
      ? `Gate ${gate}`
      : zone === 'Annex Building' && annex
        ? `Annex Building ${annex}`
        : zone

    if (!zoneLabel && !landmark) return ''
    if (!zoneLabel) return landmark
    if (!landmark) return zoneLabel
    return `${zoneLabel} - ${landmark}`
  }, [form.locationZone, form.gateNumber, form.annexNumber, form.landmark])
  const isReadyToPost = filledFields === requiredFieldCount && !posting

  useEffect(() => {
    if (navRef.current) {
      navRef.current.scrollTop = 0
    }
  }, [])

  function updateField(field, value) {
    if (error) {
      setError('')
    }
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function updateCategory(value) {
    if (error) {
      setError('')
    }

    setForm((prev) => {
      const next = { ...prev, category: value }
      if (!normalizeCategory(value).includes('errand')) {
        next.errandType = ''
      }
      if (!normalizeCategory(value).includes('tutor')) {
        next.tutoringCourse = ''
        next.tutoringYear = ''
      }
      if (!normalizeCategory(value).includes('moving')) {
        next.movingType = ''
      }
      if (!normalizeCategory(value).includes('delivery')) {
        next.itemName = ''
        next.itemQuantity = '1'
      }
      return next
    })
  }

  async function resolveCategoryId() {
    const selected = form.category
    const selectedKey = normalizeCategory(selected)

    const found = categories.find(
      (category) => normalizeCategory(category.CategoryName) === selectedKey
    )

    if (found) {
      return Number(found.CategoryID)
    }

    const created = await api.createCategory(selected)
    setCategories((prev) => [...prev, created])
    return Number(created.CategoryID)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (
      !form.title.trim() ||
      !form.description.trim() ||
      !form.locationZone ||
      (isErrandsTask && !form.errandType) ||
      (isTutoringTask && !form.tutoringCourse.trim()) ||
      (isTutoringTask && !form.tutoringYear) ||
      (isMovingTask && !form.movingType.trim()) ||
      (form.locationZone === 'Gate' && !form.gateNumber) ||
      (form.locationZone === 'Annex Building' && !form.annexNumber) ||
      !form.landmark.trim() ||
      !form.budget
    ) {
      setError('Please complete all fields before posting.')
      return
    }

    const budgetValue = Number(form.budget)
    if (!Number.isFinite(budgetValue) || budgetValue <= 0) {
      setError('Budget must be greater than 0.')
      return
    }

    try {
      const categoryId = await resolveCategoryId()
      const autoTaskTime = new Date().toISOString()

      await onSubmitTask({
        title: form.title.trim(),
        description: form.description.trim(),
        location: combinedLocation,
        taskTime: autoTaskTime,
        budget: budgetValue,
        categoryId,
        paymentMethod: form.paymentMethod,
      })

      // Reset form after successful submission
      setForm({
        title: '',
        description: '',
        category: defaultCategoryNames[0],
        errandType: '',
        tutoringCourse: '',
        tutoringYear: '',
        movingType: '',
        itemName: '',
        itemQuantity: '1',
        locationZone: '',
        gateNumber: '',
        annexNumber: '',
        landmark: '',
        budget: '',
        paymentMethod: 'Cash',
      })

      navigate('/tasks')
    } catch (err) {
      setError(err.message || 'Unable to post task right now.')
    }
  }

  return (
    <section className="page post-task-page">
      <header className="post-task-header">
        <button type="button" className="post-task-back" aria-label="Go back" onClick={() => navigate(-1)}>
          ←
        </button>
        <div className="post-task-hero-copy">
          <span className="page-eyebrow">Create request</span>
          <h1>Post a Task</h1>
          <p>Share the job clearly so the right helper can act on it quickly.</p>

        </div>

        <div className="post-task-progress-card" aria-label="Task completion status">
          <div className="post-task-progress-copy">
            <span>Task readiness</span>
            <strong>{completionPercent}%</strong>
          </div>
          <div className="post-task-progress-track" aria-hidden="true">
            <span style={{ width: `${completionPercent}%` }} />
          </div>
          <p>{filledFields}/{requiredFieldCount} fields completed</p>
        </div>
      </header>

      {error && <div className="feedback error">{error}</div>}

      <div className="post-task-layout">
        <form className="post-task-form" onSubmit={handleSubmit}>
          <article className="post-card">
            <label htmlFor="task-title">Task Title</label>
            <p className="post-card-hint">Use a short action phrase that tells helpers what needs to happen.</p>
            <input
              id="task-title"
              type="text"
              placeholder="E.g. Buy coffee from Starbucks"
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              maxLength={100}
              required
            />
            <small className="post-field-meta">{form.title.length}/100 characters</small>
          </article>

          <article className="post-card">
            <label htmlFor="task-description">Description</label>
            <p className="post-card-hint">Include the details, special instructions, and anything helpers should bring.</p>
            <textarea
              id="task-description"
              placeholder="Provide details about the task..."
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
              maxLength={500}
              rows={5}
              required
            />
            <small className="post-field-meta">{form.description.length}/500 characters</small>
          </article>

          <article className="post-card">
            <p className="field-label">Category</p>
            <p className="post-card-hint">Pick the closest category to help the right people find it faster.</p>
            <div className="chip-grid">
              {categoryNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`chip ${form.category === name ? 'active' : ''}`}
                  onClick={() => updateCategory(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          </article>

          {isErrandsTask && (
            <article className="post-card">
              <label htmlFor="task-errand-type">Errand Type</label>
              <p className="post-card-hint">Choose what kind of errand this is.</p>
              <select
                id="task-errand-type"
                value={form.errandType}
                onChange={(event) => updateField('errandType', event.target.value)}
                required
              >
                <option value="" disabled>Select errand type</option>
                {errandTaskOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </article>
          )}

          {isTutoringTask && (
            <article className="post-card">
              <label htmlFor="task-tutoring-course">Course</label>
              <p className="post-card-hint">Enter the course related to this tutoring request.</p>
              <input
                id="task-tutoring-course"
                type="text"
                placeholder="E.g. BSIT, Nursing, BSMT, etc."
                value={form.tutoringCourse}
                onChange={(event) => updateField('tutoringCourse', event.target.value)}
                maxLength={80}
                required
              />

              <label htmlFor="task-tutoring-year">Year</label>
              <select
                id="task-tutoring-year"
                value={form.tutoringYear}
                onChange={(event) => updateField('tutoringYear', event.target.value)}
                required
              >
                <option value="" disabled>Select year level</option>
                {tutoringYearOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </article>
          )}

          {isMovingTask && (
            <article className="post-card">
              <label htmlFor="task-moving-type">What to move</label>
              <p className="post-card-hint">Specify the items that need to be moved.</p>
              <input
                id="task-moving-type"
                type="text"
                placeholder="E.g. 2 boxes, 1 small cabinet, and a fan"
                value={form.movingType}
                onChange={(event) => updateField('movingType', event.target.value)}
                maxLength={120}
                required
              />
            </article>
          )}

          {isPurchaseTask && (
            <article className="post-card">
              <label htmlFor="task-item-name">Item Name (for delivery tasks)</label>
              <p className="post-card-hint">Try typing "Pares", "Milk Tea", or "Chicken Meal" for automatic pricing.</p>
              <input
                id="task-item-name"
                type="text"
                placeholder="Enter item name"
                value={form.itemName}
                onChange={(event) => updateField('itemName', event.target.value)}
                list="common-items-list"
                maxLength={100}
              />
              <datalist id="common-items-list">
                <option value="Pares" />
                <option value="Siomai Rice" />
                <option value="Chicken Meal" />
                <option value="Milk Tea" />
                <option value="Corndog" />
                <option value="Burger" />
                <option value="Coke / Sprite" />
                <option value="Bottled Water" />
                <option value="School Supplies" />
              </datalist>

              <label htmlFor="task-item-quantity">Quantity</label>
              <input
                id="task-item-quantity"
                type="number"
                inputMode="numeric"
                min="1"
                max="99"
                value={form.itemQuantity}
                onChange={(event) => updateField('itemQuantity', event.target.value)}
              />

              <label htmlFor="task-product-price">Estimated Item Cost (₱)</label>
              <p className="post-card-hint">
                {isItemRecognized
                  ? "Smart price detected! This field is now locked for accuracy."
                  : "Item not recognized. Please enter an estimated cost for the helper."
                }
              </p>

              {isItemRecognized ? (
                <div className="budget-input-wrapper read-only mini">
                  <div className="budget-display-value mini">₱{form.productPrice || '0'}</div>
                  <div className="budget-status-tag">Verified</div>
                </div>
              ) : (
                <input
                  id="task-product-price"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Enter estimated price"
                  value={form.productPrice}
                  onChange={(event) => updateField('productPrice', event.target.value)}
                  required
                />
              )}
            </article>
          )}

          <div className="post-task-grid">
            <article className="post-card">
              <label htmlFor="task-location-zone">Campus Zone</label>
              <p className="post-card-hint">Choose the nearest zone first so helpers can navigate to the right area faster.</p>
              <select
                id="task-location-zone"
                value={form.locationZone}
                onChange={(event) => {
                  const nextZone = event.target.value
                  updateField('locationZone', nextZone)
                  if (nextZone !== 'Gate') {
                    updateField('gateNumber', '')
                  }
                  if (nextZone !== 'Annex Building') {
                    updateField('annexNumber', '')
                  }
                }}
                required
              >
                <option value="" disabled>Select a campus zone</option>
                {campusLocationZones.map((zone) => (
                  <option key={zone} value={zone}>{zone}</option>
                ))}
              </select>

              {form.locationZone === 'Gate' && (
                <>
                  <label htmlFor="task-gate-number">Gate Number</label>
                  <select
                    id="task-gate-number"
                    value={form.gateNumber}
                    onChange={(event) => updateField('gateNumber', event.target.value)}
                    required
                  >
                    <option value="" disabled>Select gate number</option>
                    {campusGateNumbers.map((gate) => (
                      <option key={gate} value={gate}>Gate {gate}</option>
                    ))}
                  </select>
                </>
              )}

              {form.locationZone === 'Annex Building' && (
                <>
                  <label htmlFor="task-annex-number">Annex Number</label>
                  <select
                    id="task-annex-number"
                    value={form.annexNumber}
                    onChange={(event) => updateField('annexNumber', event.target.value)}
                    required
                  >
                    <option value="" disabled>Select annex number</option>
                    {annexBuildingNumbers.map((annex) => (
                      <option key={annex} value={annex}>Annex {annex}</option>
                    ))}
                  </select>
                </>
              )}

              <label htmlFor="task-landmark">Landmark / Building Detail</label>
              <input
                id="task-landmark"
                type="text"
                placeholder="E.g. Outside Library entrance, 2nd floor room 204"
                value={form.landmark}
                onChange={(event) => updateField('landmark', event.target.value)}
                maxLength={140}
                required
              />
            </article>

            <article className="post-card">
              <label htmlFor="task-budget">Final Budget (₱)</label>
              <p className="post-card-hint">Calculated automatically for your safety and fairness. This field cannot be manually edited.</p>

              <div className="budget-input-wrapper read-only">
                <div className="budget-display-value">₱{form.budget}</div>
                <div className="budget-status-tag student">Student Rate Applied</div>
              </div>

              <div className="price-breakdown-box premium student-themed">
                <div className="price-row">
                  <span><i className="icon">🏷️</i> Service Fee (Student Rate)</span>
                  <span>₱{budgetDetails.baseFee}</span>
                </div>
                <div className="price-row">
                  <span><i className="icon">⏳</i> Time & Complexity</span>
                  <span>₱{budgetDetails.complexityFee}</span>
                </div>
                {budgetDetails.prodPrice > 0 && (
                  <div className="price-row highlight">
                    <span><i className="icon">🛍️</i> Item Cost (Student Price)</span>
                    <span>₱{budgetDetails.prodPrice}</span>
                  </div>
                )}
                <div className="price-row student-discount">
                  <span><i className="icon">🛡️</i> Platform Fee (Only 5%)</span>
                  <span>₱{budgetDetails.protectionFee}</span>
                </div>
                <div className="price-total-row">
                  <span>Student Total to Pay</span>
                  <strong>₱{form.budget}</strong>
                </div>
              </div>
            </article>

            <article className="post-card payment-method-card">
              <p className="field-label">Payment Method</p>
              <p className="post-card-hint">Let helpers know how you plan to pay.</p>
              <div className="chip-grid two-col">
                {['Cash', 'GCash'].map((method) => (
                  <button
                    key={method}
                    type="button"
                    className={`chip payment-chip ${method === 'GCash' ? 'payment-chip-gcash' : 'payment-chip-cash'} ${form.paymentMethod === method ? 'active' : ''}`}
                    onClick={() => updateField('paymentMethod', method)}
                  >
                    {method === 'GCash' ? (
                      <span className="payment-chip-content">
                        <span className="payment-chip-badge" aria-hidden="true">GC</span>
                        <span className="payment-chip-copy">
                          <strong>GCash</strong>
                          <span>Send through wallet</span>
                        </span>
                      </span>
                    ) : (
                      <span className="payment-chip-content">
                        <span className="payment-chip-badge payment-chip-badge-cash" aria-hidden="true">₱</span>
                        <span className="payment-chip-copy">
                          <strong>Cash</strong>
                          <span>Pay on handoff</span>
                        </span>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </article>
          </div>

          <button type="submit" className="post-submit-btn" disabled={posting || !isReadyToPost}>
            {posting ? 'Posting...' : 'Post Task'}
          </button>
        </form>

        <aside className="post-task-preview" aria-label="Task preview">
          <div className="post-task-preview-card">
            <span className="post-task-preview-label">Preview</span>
            <h2>{previewTitle}</h2>
            <p>{previewDescription}</p>

            <dl className="post-task-preview-list">
              <div>
                <dt>Category</dt>
                <dd>{form.category}</dd>
              </div>
              {isErrandsTask && (
                <div>
                  <dt>Errand Type</dt>
                  <dd>{form.errandType || 'Select errand type'}</dd>
                </div>
              )}
              {isTutoringTask && (
                <>
                  <div>
                    <dt>Course</dt>
                    <dd>{form.tutoringCourse.trim() || 'Add course'}</dd>
                  </div>
                  <div>
                    <dt>Year</dt>
                    <dd>{form.tutoringYear || 'Select year level'}</dd>
                  </div>
                </>
              )}
              {isMovingTask && (
                <div>
                  <dt>What to move</dt>
                  <dd>{form.movingType.trim() || 'Specify what to move'}</dd>
                </div>
              )}
              <div>
                <dt>Location</dt>
                <dd>{combinedLocation || 'Select a zone and add a landmark'}</dd>
              </div>
              {isPurchaseTask && (
                <>
                  <div>
                    <dt>Item</dt>
                    <dd>{form.itemName.trim() || 'No item specified'}</dd>
                  </div>
                  <div>
                    <dt>Quantity</dt>
                    <dd>{itemQuantity}</dd>
                  </div>
                </>
              )}

              <div>
                <dt>Budget</dt>
                <dd>{previewBudget}</dd>
              </div>
              <div>
                <dt>Payment</dt>
                <dd>{form.paymentMethod}</dd>
              </div>
            </dl>

            <div className="post-task-preview-note">
              <strong>{isReadyToPost ? 'Ready to publish' : 'Almost there'}</strong>
              <p>{isReadyToPost ? 'Your task is complete and ready to submit.' : 'Finish every field to unlock posting.'}</p>
            </div>
          </div>

          <div className="post-task-tip-card">
            <h3>Helpful tips</h3>
            <ul>
              <li>Be specific about the location and timing.</li>
              <li>Add enough detail so helpers know the exact scope.</li>
              <li>Use a fair budget to attract faster responses.</li>
            </ul>
          </div>
        </aside>
      </div>



      <nav ref={navRef} className="nav-hint" aria-label="Bottom navigation">
        <div className="sidebar-header">
          <span className="sidebar-brand-icon" aria-hidden="true">
            <img src="/gawalogo.png" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
          </span>
          <span className="sidebar-brand">GawaHelper</span>
        </div>
        <button type="button" className="nav-item" onClick={() => navigate('/home')}>
          <span className="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="presentation" focusable="false">
              <path d="M4 11.5 12 4l8 7.5V20H4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </span>
          <span>Home</span>
        </button>
        <button type="button" className="nav-item active" aria-current="page" onClick={() => navigate('/tasks')}>
          <span className="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="presentation" focusable="false">
              <path d="M5 6h6v6H5z" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M14 7h5M14 12h5M5 17h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <span>My Tasks</span>
        </button>
        {(Number(user?.IsAdmin) === 1 || user?.IsAdmin === true || String(user?.IsAdmin) === '1') && (
          <button type="button" className="nav-item" onClick={() => navigate('/admin')}>
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                <path d="M5 6h6v6H5z" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M14 7h5M14 12h5M5 17h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <span>Admin Panels</span>
          </button>
        )}
        {(Number(user?.IsAdmin) === 1 || user?.IsAdmin === true || String(user?.IsAdmin) === '1') && (
          <button type="button" className="nav-item" onClick={() => navigate('/reports')}>
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                <path d="M3 3v18h18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M7 16l4-8 4 4 4-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span>Reports</span>
          </button>
        )}
        <button type="button" className="nav-item" onClick={() => navigate('/notifications')}>
          <span className={`nav-icon ${hasUnreadNotifications ? 'has-alert' : ''}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" role="presentation" focusable="false">
              <path d="M18 8a6 6 0 0 0-12 0v5l-2 3h16l-2-3z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 19a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {hasUnreadNotifications && <span className="nav-alert-dot" />}
          </span>
          <span>Notifications</span>
        </button>
        <button type="button" className="nav-item" onClick={() => navigate('/profile')}>
          <span className="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="presentation" focusable="false">
              <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M5 20a7 7 0 0 1 14 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <span>Profile</span>
        </button>

        <button type="button" className="nav-item" onClick={onLogout}>
          <span className="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="presentation" focusable="false">
              <path d="M10 7V5a2 2 0 0 1 2-2h6v18h-6a2 2 0 0 1-2-2v-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 12h11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="m6 9 3 3-3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>Log out</span>
        </button>
      </nav>
    </section>
  )
}

export default PostTaskPage
