const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  // Fallback: use Bearer token from localStorage when cross-domain cookies are blocked (e.g. Incognito)
  const storedToken = localStorage.getItem('gh_token')
  if (storedToken && storedToken !== 'undefined') {
    headers['Authorization'] = `Bearer ${storedToken}`
  }

  let response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    })
  } catch {
    throw new Error('Cannot connect to API server. Start app with npm run dev.')
  }

  const raw = await response.text()
  let data = {}

  if (raw) {
    try {
      data = JSON.parse(raw)
    } catch {
      data = { message: raw }
    }
  }

  if (!response.ok) {
    const fallback =
      response.status >= 500
        ? 'Server error. Make sure backend is running and database is reachable.'
        : `Request failed (${response.status})`
    throw new Error((data && data.message) || fallback)
  }

  return data
}

export const api = {
  getPublicStats() {
    return request('/public/stats')
  },
  getMe() {
    return request('/me')
  },
  homeSummary() {
    return request('/home/summary')
  },
  listNotifications() {
    return request('/notifications')
  },
  markNotificationAsRead(notificationId) {
    return request(`/notifications/${notificationId}`, {
      method: 'PATCH',
    })
  },
  myRatingSummary() {
    return request('/me/rating-summary')
  },
  updateMyProfileImage(imageDataUrl, fileName = '') {
    return request('/me/profile-image', {
      method: 'POST',
      body: JSON.stringify({ imageDataUrl, fileName }),
    })
  },
  generateWebAuthnRegOptions() {
    return request('/webauthn/generate-registration-options', { method: 'POST' })
  },
  verifyWebAuthnReg(payload) {
    return request('/webauthn/verify-registration', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  generateWebAuthnAuthOptions(email) {
    return request('/webauthn/generate-authentication-options', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },
  verifyWebAuthnAuth(email, payload) {
    return request('/webauthn/verify-authentication', {
      method: 'POST',
      body: JSON.stringify({ email, body: payload }),
    })
  },
  register(payload) {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  login(payload) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  logout() {
    return request('/auth/logout', {
      method: 'POST',
    })
  },
  changePassword(payload) {
    return request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  requestPasswordResetCode(email) {
    return request('/auth/forgot-password/request-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },
  verifyPasswordResetCode(email, code) {
    return request('/auth/forgot-password/verify-code', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    })
  },
  resetPasswordWithCode(email, code, newPassword) {
    return request('/auth/forgot-password/reset', {
      method: 'POST',
      body: JSON.stringify({ email, code, newPassword }),
    })
  },
  // Email verification
  verifyEmail(email, code) {
    return request('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    })
  },
  resendVerification(email) {
    return request('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },
  listUsers() {
    return request('/users')
  },
  listCategories() {
    return request('/categories')
  },
  createCategory(categoryName) {
    return request('/categories', {
      method: 'POST',
      body: JSON.stringify({ categoryName }),
    })
  },
  updateCategory(categoryId, categoryName) {
    return request(`/categories/${categoryId}`, {
      method: 'PATCH',
      body: JSON.stringify({ categoryName }),
    })
  },
  deleteCategory(categoryId) {
    return request(`/categories/${categoryId}`, {
      method: 'DELETE',
    })
  },
  // Enhanced task browsing
  listTasks(limit = 50, offset = 0) {
    return request(`/tasks?limit=${limit}&offset=${offset}`)
  },
  browseTasks({ search, categoryId, location, sort, limit = 20, offset = 0 } = {}) {
    const params = new URLSearchParams()
    params.set('status', 'Open')
    if (search) params.set('search', search)
    if (categoryId) params.set('categoryId', categoryId)
    if (location) params.set('location', location)
    if (sort) params.set('sort', sort)
    params.set('limit', String(limit))
    params.set('offset', String(offset))
    return request(`/tasks?${params.toString()}`)
  },
  getTaskCountsByCategory() {
    return request('/tasks/counts-by-category')
  },
  getTask(taskId) {
    return request(`/tasks/${taskId}`)
  },
  createTask(payload) {
    return request('/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  updateTask(taskId, payload) {
    return request(`/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },
  deleteTask(taskId) {
    return request(`/tasks/${taskId}`, {
      method: 'DELETE',
    })
  },
  applyTask(taskId) {
    return request(`/tasks/${taskId}/apply`, {
      method: 'POST',
    })
  },
  cancelTask(taskId, reason) {
    return request(`/tasks/${taskId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  },
  submitTaskProof(taskId, fileName, proofDataUrl = '') {
    return request(`/tasks/${taskId}/proof`, {
      method: 'POST',
      body: JSON.stringify({ fileName, proofDataUrl }),
    })
  },
  deleteTaskProof(taskId) {
    return request(`/tasks/${taskId}/proof`, {
      method: 'DELETE',
    })
  },
  submitTaskReview(taskId, rating, comment = '') {
    return request(`/tasks/${taskId}/review`, {
      method: 'POST',
      body: JSON.stringify({ rating, comment }),
    })
  },
  updateTaskStatus(taskId, status) {
    return request(`/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },
  approveTaskProof(taskId) {
    return request(`/tasks/${taskId}/approve-proof`, {
      method: 'PATCH',
    })
  },
  rejectTaskProof(taskId, reason = '') {
    return request(`/tasks/${taskId}/reject-proof`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  },
  sendFeedbackMessage(taskId, message) {
    return request(`/tasks/${taskId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    })
  },
  // Payment flow — two-sided handshake
  confirmPaymentSent(taskId) {
    return request(`/tasks/${taskId}/confirm-payment-sent`, {
      method: 'POST',
    })
  },
  confirmPaymentReceived(taskId) {
    return request(`/tasks/${taskId}/payment-received`, {
      method: 'POST',
    })
  },
  // Disputes
  raiseDispute(taskId, reason) {
    return request(`/tasks/${taskId}/dispute`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  },
  // User profile
  getUserProfile(userId) {
    return request(`/users/${userId}/profile`)
  },
  myTasks(limit = 50, offset = 0) {
    return request(`/my/tasks?limit=${limit}&offset=${offset}`)
  },
  myReviews() {
    return request('/me/reviews')
  },
  myTaskHistory() {
    return request('/me/history')
  },
  myPendingRatings() {
    return request('/me/pending-ratings')
  },
  getMessages(otherUserId, taskId) {
    return request(`/messages/${otherUserId}/${taskId}`)
  },
  sendMessage(taskId, recipientId, data) {
    return request('/messages', {
      method: 'POST',
      body: JSON.stringify({ taskId, recipientId, ...data }),
    })
  },
  markMessageAsRead(messageId) {
    return request(`/messages/${messageId}`, {
      method: 'PATCH',
    })
  },
  markTaskMessagesAsRead(taskId) {
    return request(`/messages/mark-as-read/${taskId}`, {
      method: 'PATCH',
    })
  },
  // Reports & Data Visualization
  getReportsSummary() {
    return request('/admin/summary')
  },
  getTransactions() {
    return request('/admin/transactions')
  },
  getActivityLogs() {
    return request('/admin/activity')
  },
  // Admin Methods
  getAdminStats() {
    return request('/admin/stats')
  },
  getAdminUsers(limit = 50, offset = 0) {
    return request(`/admin/users?limit=${limit}&offset=${offset}`)
  },
  getAdminTasks(limit = 50, offset = 0) {
    return request(`/admin/tasks?limit=${limit}&offset=${offset}`)
  },
  getAdminMessages() {
    return request('/admin/messages')
  },
  adminLogin(payload) {
    return request('/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  adminChangePassword(newPassword) {
    return request('/auth/admin-change-password', {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    })
  },
  getSseUrl() {
    return `${API_BASE_URL}/sse/stream`
  },
  adminCreateUser(payload) {
    return request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  adminUpdateUser(userId, payload) {
    return request(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },
  adminSuspendUser(userId) {
    return request(`/admin/users/${userId}/suspend`, { method: 'POST' })
  },
  adminActivateUser(userId) {
    return request(`/admin/users/${userId}/activate`, { method: 'POST' })
  },
  adminDeleteTask(taskId) {
    return request(`/admin/tasks/${taskId}`, { method: 'DELETE' })
  },
  getAdminAuditLog(limit = 50, offset = 0) {
    return request(`/admin/audit-log?limit=${limit}&offset=${offset}`)
  },
  adminResetAllData() {
    return request('/admin/reset-all-data', { method: 'POST' })
  },
  getCurrentUser() {
    return request('/me')
  },
  getUserRatingSummary() {
    return request('/me/rating-summary')
  }
}
