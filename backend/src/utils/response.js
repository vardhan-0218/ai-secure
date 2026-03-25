function sendSuccess(res, data, status = 200) {
  return res.status(status).json({ success: true, data, error: null });
}

function sendError(res, status, error, data = null) {
  return res.status(status).json({ success: false, data, error });
}

module.exports = { sendSuccess, sendError };

