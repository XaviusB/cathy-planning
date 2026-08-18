using CathyPlanning.Domain.Entities;
using CathyPlanning.Domain.ValueObjects;

namespace CathyPlanning.Domain.Services;

public class ComplianceService
{
    public ComplianceReport Evaluate(PlanningSession session)
        => EvaluateForPeriod(session, DateTime.MinValue, DateTime.MaxValue);

    /// <summary>Evaluates compliance and hours only for shifts within [periodStart, periodEnd).</summary>
    public ComplianceReport EvaluateForPeriod(PlanningSession session, DateTime periodStart, DateTime periodEnd)
    {
        var violations = new List<ComplianceViolation>();
        var summaries = new List<EmployeeHoursSummary>();

        foreach (var employee in session.Employees)
        {
            var allEmpShifts = session.Shifts
                .Where(s => s.EmployeeId == employee.Id)
                .OrderBy(s => s.Start)
                .ToList();

            // Only hours within the period
            var periodShifts = allEmpShifts
                .Where(s => s.Start < periodEnd && s.End > periodStart)
                .ToList();

            double totalHours = periodShifts.Sum(s => s.Duration.TotalHours);

            var empViolations = new List<ComplianceViolation>();

            foreach (var rule in session.RestRules)
            {
                // Check minimum rest between shifts (all shifts, not just period)
                for (int i = 1; i < allEmpShifts.Count; i++)
                {
                    var prev = allEmpShifts[i - 1];
                    var curr = allEmpShifts[i];
                    // Only report violation if it falls within the period
                    if (curr.Start < periodEnd && prev.End > periodStart)
                    {
                        var rest = curr.Start - prev.End;
                        if (rest < rule.MinRestBetweenShifts)
                        {
                            var v = new ComplianceViolation
                            {
                                EmployeeId = employee.Id,
                                EmployeeName = employee.Name,
                                Severity = ComplianceSeverity.Error,
                                Message = $"Insufficient rest ({rest.TotalHours:F1}h) between shift ending {prev.End:g} and shift starting {curr.Start:g}. Minimum required: {rule.MinRestBetweenShifts.TotalHours}h."
                            };
                            violations.Add(v);
                            empViolations.Add(v);
                        }
                    }
                }

                // Check weekly rest
                CheckWeeklyRest(employee, allEmpShifts, rule, session.Rotation, violations, empViolations, periodStart, periodEnd);
            }

            summaries.Add(new EmployeeHoursSummary
            {
                EmployeeId = employee.Id,
                EmployeeName = employee.Name,
                TotalHours = totalHours,
                MaxWeeklyHours = employee.MaxWeeklyHours,
                ViolationCount = empViolations.Count
            });
        }

        return new ComplianceReport { Violations = violations, HoursSummaries = summaries };
    }

    private static void CheckWeeklyRest(
        Employee employee,
        List<ShiftAssignment> orderedShifts,
        RestRule rule,
        RotationDefinition rotation,
        List<ComplianceViolation> violations,
        List<ComplianceViolation> empViolations,
        DateTime periodStart,
        DateTime periodEnd)
    {
        for (int week = 0; week < rotation.WeekCount; week++)
        {
            var weekStart = rotation.StartDate.AddDays(week * 7);
            var weekEnd = weekStart.AddDays(7);

            // Only check weeks that overlap the period
            if (weekEnd <= periodStart || weekStart >= periodEnd) continue;

            var weekShifts = orderedShifts
                .Where(s => s.Start < weekEnd && s.End > weekStart)
                .OrderBy(s => s.Start)
                .ToList();

            if (!weekShifts.Any()) continue;

            double maxRestHours = 0;

            var prevShift = orderedShifts.LastOrDefault(s => s.End <= weekStart);
            var gapBefore = weekShifts.First().Start - (prevShift?.End ?? weekStart);
            maxRestHours = Math.Max(maxRestHours, gapBefore.TotalHours);

            var nextShift = orderedShifts.FirstOrDefault(s => s.Start >= weekEnd);
            var gapAfter = (nextShift?.Start ?? weekEnd) - weekShifts.Last().End;
            maxRestHours = Math.Max(maxRestHours, gapAfter.TotalHours);

            for (int i = 1; i < weekShifts.Count; i++)
                maxRestHours = Math.Max(maxRestHours, (weekShifts[i].Start - weekShifts[i - 1].End).TotalHours);

            if (maxRestHours < rule.MinWeeklyRest.TotalHours)
            {
                var v = new ComplianceViolation
                {
                    EmployeeId = employee.Id,
                    EmployeeName = employee.Name,
                    Severity = ComplianceSeverity.Error,
                    Message = $"Insufficient weekly rest in week starting {weekStart:d}: max contiguous rest is {maxRestHours:F1}h, minimum required: {rule.MinWeeklyRest.TotalHours}h."
                };
                violations.Add(v);
                empViolations.Add(v);
            }
        }
    }
}
