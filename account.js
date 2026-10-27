
const express = require("express");
const { authMiddleware } = require("../middleware");
const { Account } = require("../db");
const mongoose = require("mongoose");

const router = express.Router();

// 1. Get user balance
router.get("/balance", authMiddleware, async (req, res) => {
    const account = await Account.findOne({
        userId: req.userId
    });

    if (!account) {
        return res.status(404).json({
            message: "Account not found"
        });
    }

    return res.json({
        balance: account.balance
    });
});

// 2. Transfer money
router.post("/transfer", authMiddleware, async (req, res) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const { amount, to } = req.body;

        // Find sender's account
        const account = await Account.findOne({
            userId: req.userId
        }).session(session);

        if (!account || amount <= 0 || account.balance < amount) {
            await session.abortTransaction();

            return res.status(400).json({
                message: "Insufficient balance"
            });
        }

        // Find receiver's account
        const toAccount = await Account.findOne({
            userId: to
        }).session(session);

        if (!toAccount) {
            await session.abortTransaction();

            return res.status(400).json({
                message: "Invalid account"
            });
        }

        // Deduct money from sender
        await Account.updateOne(
            { userId: req.userId },
            { $inc: { balance: -amount } },
            { session }
        );

        // Add money to receiver
        await Account.updateOne(
            { userId: to },
            { $inc: { balance: amount } },
            { session }
        );

        await session.commitTransaction();

        return res.json({
            message: "Transfer successful"
        });

    } catch (error) {
        await session.abortTransaction();

        return res.status(500).json({
            message: "Transfer failed"
        });

    } finally {
        await session.endSession();
    }
});

module.exports = router;
