/**
 * @openapi
 * /api/feedback:
 *   get:
 *     tags: [Feedback]
 *     summary: List feedback
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feedback list
 *   post:
 *     tags: [Feedback]
 *     summary: Create feedback
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Feedback created
 *
 * /api/okrs:
 *   get:
 *     tags: [OKRs]
 *     summary: List OKRs
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OKR list
 *   post:
 *     tags: [OKRs]
 *     summary: Create an OKR
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: OKR created
 *
 * /api/achievements:
 *   get:
 *     tags: [Achievements]
 *     summary: List achievements
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Achievement list
 *   post:
 *     tags: [Achievements]
 *     summary: Award an achievement
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Achievement created
 *
 * /api/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: List notifications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification list
 *
 * /api/notifications/read-all:
 *   put:
 *     tags: [Notifications]
 *     summary: Mark all notifications as read
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All marked as read
 *
 * /api/resume-analysis/analyze:
 *   post:
 *     tags: [Resume Analysis]
 *     summary: Analyze a resume with AI
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analysis results
 *
 * /api/hiring/dashboard:
 *   get:
 *     tags: [Hiring]
 *     summary: Hiring market dashboard
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Hiring insights
 *
 * /api/departments:
 *   get:
 *     tags: [Departments]
 *     summary: List departments
 *     responses:
 *       200:
 *         description: Department list
 *   post:
 *     tags: [Departments]
 *     summary: Create department
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Department created
 *
 * /api/roles:
 *   get:
 *     tags: [Roles]
 *     summary: List job roles
 *     responses:
 *       200:
 *         description: Role list
 *
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: List all users (admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User list
 */
