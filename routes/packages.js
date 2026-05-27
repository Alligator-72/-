const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');

// 用户：只看自己的快递 / 管理员：看全部（支持分页）
router.get('/', verifyToken, async (req, res) => {
    try {
        const { tracking_number, status, courier_company, page = 1, pageSize = 10 } = req.query;
        
        const currentPage = parseInt(page);
        const limit = parseInt(pageSize);
        const offset = (currentPage - 1) * limit;
        
        let whereSql = ' WHERE 1=1';
        const params = [];

        if (req.user.role !== 'admin') {
            whereSql += ' AND owner_id = ?';
            params.push(req.user.id);
        }

        if (tracking_number) {
            whereSql += ' AND tracking_number LIKE ?';
            params.push(`%${tracking_number}%`);
        }
        if (status) {
            whereSql += ' AND status = ?';
            params.push(status);
        }
        if (courier_company) {
            whereSql += ' AND courier_company LIKE ?';
            params.push(`%${courier_company}%`);
        }

        // 查询总数
        const [countResult] = await db.query(`SELECT COUNT(*) as total FROM packages${whereSql}`, params);
        const total = countResult[0].total;
        
        // 分页数据
        const [packages] = await db.query(
            `SELECT * FROM packages${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );
        
        res.json({
            data: packages,
            pagination: {
                page: currentPage,
                pageSize: limit,
                total: total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('查询快递错误:', error);
        res.status(500).json({ message: '查询失败' });
    }
});

// 获取单个快递
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const [packages] = await db.query('SELECT * FROM packages WHERE id = ?', [req.params.id]);
        if (packages.length === 0) {
            return res.status(404).json({ message: '快递不存在' });
        }
        if (req.user.role !== 'admin' && packages[0].owner_id !== req.user.id) {
            return res.status(403).json({ message: '无权查看' });
        }
        res.json(packages[0]);
    } catch (error) {
        res.status(500).json({ message: '查询失败' });
    }
});

// 管理员添加快递
router.post('/', verifyToken, isAdmin, async (req, res) => {
    try {
        const { tracking_number, recipient_name, recipient_phone, courier_company, status, pickup_location, pickup_code, description, owner_id } = req.body;

        const [existing] = await db.query('SELECT id FROM packages WHERE tracking_number = ?', [tracking_number]);
        if (existing.length > 0) {
            return res.status(400).json({ message: '快递单号已存在' });
        }

        const [result] = await db.query(
            'INSERT INTO packages (tracking_number, recipient_name, recipient_phone, courier_company, status, pickup_location, pickup_code, description, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [tracking_number, recipient_name, recipient_phone, courier_company, status || '待取件', pickup_location, pickup_code, description, owner_id || null]
        );

        res.status(201).json({ message: '添加快递成功', packageId: result.insertId });
    } catch (error) {
        console.error('添加快递错误:', error);
        res.status(500).json({ message: '添加失败' });
    }
});

// 管理员修改快递
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const { tracking_number, recipient_name, recipient_phone, courier_company, status, pickup_location, pickup_code, description, owner_id } = req.body;

        const [result] = await db.query(
            'UPDATE packages SET tracking_number=?, recipient_name=?, recipient_phone=?, courier_company=?, status=?, pickup_location=?, pickup_code=?, description=?, owner_id=? WHERE id=?',
            [tracking_number, recipient_name, recipient_phone, courier_company, status, pickup_location, pickup_code, description, owner_id || null, req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: '快递不存在' });
        }

        res.json({ message: '修改成功' });
    } catch (error) {
        console.error('修改快递错误:', error);
        res.status(500).json({ message: '修改失败' });
    }
});

// 管理员删除快递
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM packages WHERE id = ?', [req.params.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: '快递不存在' });
        }

        res.json({ message: '删除成功' });
    } catch (error) {
        console.error('删除快递错误:', error);
        res.status(500).json({ message: '删除失败' });
    }
});

module.exports = router;