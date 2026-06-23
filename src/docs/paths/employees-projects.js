/**
 * @openapi
 * /api/employees/me:
 *   get:
 *     tags: [Employees]
 *     summary: Get my employee record
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Employee profile
 *
 * /api/employees/profile:
 *   get:
 *     tags: [Employees]
 *     summary: Get employee profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile data
 *
 * /api/employees/dashboard/stats:
 *   get:
 *     tags: [Employees]
 *     summary: Employee dashboard stats
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *
 * /api/employees/me/projects:
 *   get:
 *     tags: [Employees]
 *     summary: Get my assigned projects
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Project list
 *
 * /api/employees/me/payroll:
 *   get:
 *     tags: [Employees]
 *     summary: Get my payroll records
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payroll history
 *
 * /api/projects:
 *   get:
 *     tags: [Projects]
 *     summary: List projects
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Project list
 *   post:
 *     tags: [Projects]
 *     summary: Create a project
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Project created
 *
 * /api/projects/{id}:
 *   get:
 *     tags: [Projects]
 *     summary: Get project by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project details
 *
 * /api/projects/{projectId}/chat/messages:
 *   get:
 *     tags: [Projects]
 *     summary: Get project chat messages
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat messages
 *   post:
 *     tags: [Projects]
 *     summary: Send a chat message
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Message sent
 */
