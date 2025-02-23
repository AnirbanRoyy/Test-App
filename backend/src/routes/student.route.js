import { Router } from "express";
import { loginStudent, registerStudent } from "../controllers/student.controller.js";

const router = Router();

router.route("/register").post(registerStudent);
router.route("/login").post(loginStudent);

export default router;
