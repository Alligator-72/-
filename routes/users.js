const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
require('dotenv').config();

// 注册
router.post('/register', async (req, res) => {
    try {
        const { username, password, real_name, phone, email } = req.body;
        
        const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.status(400).json({ message: '用户名已存在' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const [result] = await db.query(
            'INSERT INTO users (username, password, real_name, phone, email, role) VALUES (?, ?, ?, ?, ?, ?)',
            [username, hashedPassword, real_name || username, phone, email, 'user']
        );
        
        res.status(201).json({ message: '注册成功', userId: result.insertId });
    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({ message: '注册失败，请稍后重试' });
    }
});

// 登录
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) {
            return res.status(401).json({ message: '用户名或密码错误' });
        }
        
        const user = users[0];
        
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ message: '用户名或密码错误' });
        }
        
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({
            message: '登录成功',
            token,
            user: {
                id: user.id,
                username: user.username,
                real_name: user.real_name,
                role: user.role
            }
        });
    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({ message: '登录失败，请稍后重试' });
    }
});

// 获取当前用户信息
router.get('/profile', verifyToken, async (req, res) => {
    try {
        const [users] = await db.query('SELECT id, username, real_name, phone, email, role FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) {
            return res.status(404).json({ message: '用户不存在' });
        }
        res.json(users[0]);
    } catch (error) {
        res.status(500).json({ message: '获取用户信息失败' });
    }
});

// 管理员获取用户列表（用于分配快递）
router.get('/list', verifyToken, isAdmin, async (req, res) => {
    try {
        const [users] = await db.query('SELECT id, username, phone FROM users WHERE role = "user"');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: '获取用户列表失败' });
    }
});

module.exports = router;