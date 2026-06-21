const Job = require('../models/Job');
const User = require('../models/User');

/**
 * Fix jobs that should be visible to candidates but were saved without isApproved
 * or left pending after verified HR posted them.
 */
async function syncCandidateVisibleJobs() {
  try {
    const activeFix = await Job.updateMany(
      {
        status: { $in: ['active', 'open'] },
        isApproved: { $ne: true },
      },
      { $set: { isApproved: true } }
    );

    const verifiedHRIds = await User.find({ role: 'hr', isVerified: true }).distinct('_id');
    let verifiedHRFix = { modifiedCount: 0 };
    if (verifiedHRIds.length > 0) {
      verifiedHRFix = await Job.updateMany(
        {
          createdBy: { $in: verifiedHRIds },
          status: 'pending',
          isApproved: { $ne: true },
        },
        { $set: { status: 'active', isApproved: true } }
      );
    }

    const totalFixed = (activeFix.modifiedCount || 0) + (verifiedHRFix.modifiedCount || 0);
    if (totalFixed > 0) {
      console.log(
        `✅ Synced ${totalFixed} job(s) for candidate visibility ` +
          `(active: ${activeFix.modifiedCount || 0}, verified HR pending: ${verifiedHRFix.modifiedCount || 0})`
      );
    }

    const visibleCount = await Job.countDocuments({
      status: { $in: ['active', 'open', 'closed'] },
      isApproved: true,
    });
    console.log(`📋 ${visibleCount} job(s) currently visible to candidates`);
  } catch (err) {
    console.warn('⚠️ Job visibility sync skipped:', err.message);
  }
}

module.exports = { syncCandidateVisibleJobs };
