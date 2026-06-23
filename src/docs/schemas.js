/**
 * @openapi
 * components:
 *   schemas:
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *         message:
 *           type: string
 *     SuccessMessage:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         role:
 *           type: string
 *           enum: [admin, hr, candidate, employee]
 *         isActive:
 *           type: boolean
 *         isVerified:
 *           type: boolean
 *     LoginRequest:
 *       type: object
 *       required: [email]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           format: password
 *     LoginResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         token:
 *           type: string
 *         user:
 *           $ref: '#/components/schemas/User'
 *     SetRoleRequest:
 *       type: object
 *       required: [role]
 *       properties:
 *         role:
 *           type: string
 *           enum: [admin, hr, candidate, employee]
 *     Job:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         status:
 *           type: string
 *         minSalary:
 *           type: number
 *         maxSalary:
 *           type: number
 *         location:
 *           type: string
 *     Application:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         job:
 *           type: string
 *         candidate:
 *           type: string
 *         status:
 *           type: string
 *         resumeUrl:
 *           type: string
 *     HealthResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 *         uptime:
 *           type: number
 *         version:
 *           type: string
 *         database:
 *           type: string
 */
