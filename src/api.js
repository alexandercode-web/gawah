const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

async function request(path, options = {}) {
  const token = localStorage.getItem('gh_token')
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
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
    throw new Error(data.message || fallback)
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
  listTasks() {
    return request('/tasks')
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
  sendFeedbackMessage(taskId, message) {
    return request(`/tasks/${taskId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    })
  },
  confirmPaymentReceived(taskId) {
    return request(`/tasks/${taskId}/payment-received`, {
      method: 'POST',
    })
  },
  myTasks() {
    return request('/my/tasks')
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
    return request('/reports/summary')
  },
  getTransactions() {
    return request('/reports/transactions')
  },
  getActivityLogs() {
    return request('/reports/activity')
  },
  // Admin Methods
  getAdminStats() {
    return request('/admin/stats')
  },
  getAdminUsers() {
    return request('/admin/users')
  },
  getAdminTasks() {
    return request('/admin/tasks')
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
  getCurrentUser() {
    return request('/me')
  },
  getUserRatingSummary() {
    return request('/me/rating-summary')
  }
}
