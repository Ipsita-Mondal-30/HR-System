/**
 * When project completion reaches 100%, mark the project as completed.
 * Returns true if status was changed.
 */
function applyProjectCompletionStatus(project) {
  const pct = project.completionPercentage ?? 0;
  if (pct >= 100 && project.status !== 'cancelled' && project.status !== 'completed') {
    project.status = 'completed';
    if (!project.endDate) {
      project.endDate = new Date();
    }
    return true;
  }
  return false;
}

function isProjectCompleted(project) {
  return project.status === 'completed' || (project.completionPercentage ?? 0) >= 100;
}

module.exports = {
  applyProjectCompletionStatus,
  isProjectCompleted,
};
