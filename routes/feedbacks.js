const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');

// 配置文件上传
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 限制5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('只支持图片文件（jpg, png, gif, webp）'));
    }
});

// 用户提交反馈（支持上传图片）
router.post('/', verifyToken, upload.single('image'), async (req, res) => {
    try {
        const { title, content } = req.body;
        const image_path = req.file ? `/uploads/${req.file.filename}` : null;
        
        const [result] = await db.query(
            'INSERT INTO feedbacks (user_id, title, content, image_path) VALUES (?, ?, ?, ?)',
            [req.user.id, title, content, image_path]
        );
        
        res.status(201).json({ message: '反馈提交成功', feedbackId: result.insertId });
    } catch (error) {
        console.error('提交反馈错误:', error);
        res.status(500).json({ message: '提交失败' });
    }
});

// 查看自己的反馈（用户）
router.get('/my', verifyToken, async (req, res) => {
    try {
        const [feedbacks] = await db.query(
            'SELECT * FROM feedbacks WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(feedbacks);
    } catch (error) {
        res.status(500).json({ message: '查询失败' });
    }
});

// 管理员查看所有反馈
router.get('/all', verifyToken, isAdmin, async (req, res) => {
    try {
        const [feedbacks] = await db.query(
            'SELECT f.*, u.username, u.real_name FROM feedbacks f LEFT JOIN users u ON f.user_id = u.id ORDER BY f.created_at DESC'
        );
        res.json(feedbacks);
    } catch (error) {
        res.status(500).json({ message: '查询失败' });
    }
});

// 管理员更新反馈状态
router.put('/:id/status', verifyToken, isAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        await db.query('UPDATE feedbacks SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ message: '状态更新成功' });
    } catch (error) {
        res.status(500).json({ message: '更新失败' });
    }
});

module.exports = router;