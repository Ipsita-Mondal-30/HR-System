const SupportTicket = require('../models/SupportTicket');
const FeedbackRequest = require('../models/FeedbackRequest');
const { createNotification } = require('../services/notificationService');

const listSupportTickets = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status && status !== 'all' ? { status } : {};

    const tickets = await SupportTicket.find(filter)
      .populate({
        path: 'employee',
        populate: { path: 'user', select: 'name email' }
      })
      .populate('respondedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(tickets);
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    res.status(500).json({ error: 'Failed to fetch support tickets' });
  }
};

const respondSupportTicket = async (req, res) => {
  try {
    const { response, status } = req.body;
    const ticket = await SupportTicket.findById(req.params.id).populate({
      path: 'employee',
      populate: { path: 'user', select: '_id name email' }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (response?.trim()) {
      ticket.hrResponse = response.trim();
      ticket.respondedBy = req.user._id;
      ticket.respondedAt = new Date();
    }
    if (status && ['open', 'in-progress', 'resolved', 'closed'].includes(status)) {
      ticket.status = status;
    }

    await ticket.save();

    if (response?.trim() && ticket.employee?.user) {
      try {
        await createNotification(
          ticket.employee.user._id,
          'support_request',
          'HR Responded to Your Request',
          `HR replied to "${ticket.subject}". Check Help & Support for details.`,
          { type: 'employee', id: ticket.employee._id },
          '/employee/help'
        );
      } catch (notifyErr) {
        console.warn('Ticket saved but notification failed:', notifyErr.message);
      }
    }

    res.json(ticket);
  } catch (error) {
    console.error('Error responding to ticket:', error);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
};

const listFeedbackRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status && status !== 'all' ? { status } : {};

    const requests = await FeedbackRequest.find(filter)
      .populate({
        path: 'employee',
        populate: { path: 'user', select: 'name email' }
      })
      .populate('respondedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Error fetching feedback requests:', error);
    res.status(500).json({ error: 'Failed to fetch feedback requests' });
  }
};

const respondFeedbackRequest = async (req, res) => {
  try {
    const { response, status } = req.body;
    const request = await FeedbackRequest.findById(req.params.id).populate({
      path: 'employee',
      populate: { path: 'user', select: '_id name email' }
    });

    if (!request) {
      return res.status(404).json({ error: 'Feedback request not found' });
    }

    if (response?.trim()) {
      request.hrResponse = response.trim();
      request.respondedBy = req.user._id;
      request.respondedAt = new Date();
    }
    if (status && ['open', 'in-progress', 'resolved', 'closed'].includes(status)) {
      request.status = status;
    }

    await request.save();

    if (response?.trim() && request.employee?.user) {
      try {
        await createNotification(
          request.employee.user._id,
          'feedback_request',
          'Response to Your Feedback Request',
          `HR replied to your ${request.requestType} request. View it under Request Feedback.`,
          { type: 'employee', id: request.employee._id },
          '/employee/feedback/request'
        );
      } catch (notifyErr) {
        console.warn('Feedback request saved but notification failed:', notifyErr.message);
      }
    }

    res.json(request);
  } catch (error) {
    console.error('Error responding to feedback request:', error);
    res.status(500).json({ error: 'Failed to update feedback request' });
  }
};

module.exports = {
  listSupportTickets,
  respondSupportTicket,
  listFeedbackRequests,
  respondFeedbackRequest
};
