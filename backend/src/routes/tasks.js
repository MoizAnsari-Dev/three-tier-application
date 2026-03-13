const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Task = require('../models/Task');
const { protect } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const { getRedis } = require('../config/redis');
const logger = require('../utils/logger');

const TASK_QUEUE = 'task_queue';

// POST /api/tasks — Create a new task
router.post(
  '/',
  protect,
  apiLimiter,
  [
    body('title').trim().isLength({ min: 1, max: 100 }).withMessage('Title is required and must be under 100 chars'),
    body('inputText').trim().isLength({ min: 1, max: 10000 }).withMessage('Input text is required'),
    body('operation')
      .isIn(['uppercase', 'lowercase', 'reverse', 'word_count'])
      .withMessage('Invalid operation'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { title, inputText, operation } = req.body;

      // Create task record with status 'pending'
      const task = await Task.create({
        userId: req.user._id,
        title,
        inputText,
        operation,
        status: 'pending',
        logs: [{ message: 'Task created and queued', level: 'info' }],
      });

      // Push job to Redis queue
      const redis = getRedis();
      const job = JSON.stringify({ taskId: task._id.toString(), operation, inputText });
      await redis.rpush(TASK_QUEUE, job);

      logger.info(`Task ${task._id} queued for operation: ${operation}`);
      res.status(201).json({ success: true, message: 'Task created and queued', task });
    } catch (error) {
      logger.error('Create task error:', error);
      res.status(500).json({ success: false, message: 'Failed to create task' });
    }
  }
);

// GET /api/tasks — Get all tasks for authenticated user
router.get('/', protect, apiLimiter, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const { status } = req.query;

    const filter = { userId: req.user._id };
    if (status && ['pending', 'running', 'success', 'failed'].includes(status)) {
      filter.status = status;
    }

    const [tasks, total] = await Promise.all([
      Task.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select('-logs'),
      Task.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: tasks,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('Get tasks error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tasks' });
  }
});

// GET /api/tasks/:id — Get single task with full logs
router.get('/:id', protect, apiLimiter, async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.user._id });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    res.json({ success: true, data: task });
  } catch (error) {
    logger.error('Get task error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch task' });
  }
});

// DELETE /api/tasks/:id — Delete a task
router.delete('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    logger.error('Delete task error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete task' });
  }
});

module.exports = router;
