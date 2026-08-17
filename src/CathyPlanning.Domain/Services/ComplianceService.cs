using CathyPlanning.Domain.Entities;
using CathyPlanning.Domain.ValueObjects;

namespace CathyPlanning.Domain.Services;

public class ComplianceService
{
    public ComplianceReport Evaluate(PlanningSession session)
    {
        var violations = new List<ComplianceViolation>();
        var summaries = new List<EmployeeHoursSummary>();

        foreach (var employee in session.Employees)
        {
            var empShifts = session.Shifts
                .Where(s => s.EmployeeId == employee.Id)
                .OrderBy(s => s.Start)
                .ToList();

            double totalHours = empShifts.Sum(s => s.Duration.TotalHours);

            summaries.Add(new EmployeeHoursSummary
            {
                EmployeeId = employee.Id,
                EmployeeName = employee.Name,
                TotalHours = totalHours,
                MaxWeeklyHours = employee.MaxWeeklyHours
            });

            foreach (var rule in session.RestRules)
            {
                // Check minimum rest between shifts
                for (int i = 1; i < empShifts.Count; i++)
                {
                    var prev = empShifts[i - 1];
                    var curr = empShifts[i];
                    var rest = curr.Start - prev.End;
                    if (rest < rule.MinRestBetweenShifts)
                    {
                        violations.Add(new ComplianceViolation
                        {
                            EmployeeId = employee.Id,
                            EmployeeName = employee.Name,
                            Severity = ComplianceSeverity.Error,
                            Message = $"Insufficient rest ({rest.TotalHours:F1}h) between shift ending {prev.End:g} and shift starting {curr.Start:g}. Minimum required: {rule.MinRestBetweenShifts.TotalHours}h."
                        });
                    }
                }

                // Check weekly rest: find the max continuous rest gap in each week
                CheckWeeklyRest(employee, empShifts, rule, session.Rotation, violations);
            }
        }

        return new ComplianceReport { Violations = violations, HoursSummaries = summaries };
    }

    private static void CheckWeeklyRest(
        Employee employee,
        List<ShiftAssignment> orderedShifts,
        RestRule rule,
        RotationDefinition rotation,
        List<ComplianceViolation> violations)
    {
        for (int week = 0; week < rotation.WeekCount; week++)
        {
            var weekStart = rotation.StartDate.AddDays(week * 7);
            var weekEnd = weekStart.AddDays(7);

            var weekShifts = orderedShifts
                .Where(s => s.Start < weekEnd && s.End > weekStart)
                .OrderBy(s => s.Start)
                .ToList();

            if (!weekShifts.Any()) continue;

            double maxRestHours = 0;

            // gap before first shift
            maxRestHours = Math.Max(maxRestHours, (weekShifts.First().Start - weekStart).TotalHours);
            // gap after last shift
            maxRestHours = Math.Max(maxRestHours, (weekEnd - weekShifts.Last().End).TotalHours);
            // gaps between shifts
            for (int i = 1; i < weekShifts.Count; i++)
                maxRestHours = Math.Max(maxRestHours, (weekShifts[i].Start - weekShifts[i - 1].End).TotalHours);

            if (maxRestHours < rule.MinWeeklyRest.TotalHours)
            {
                violations.Add(new ComplianceViolation
                {
                    EmployeeId = employee.Id,
                    EmployeeName = employee.Name,
                    Severity = ComplianceSeverity.Error,
                    Message = $"Insufficient weekly rest in week starting {weekStart:d}: max contiguous rest is {maxRestHours:F1}h, minimum required: {rule.MinWeeklyRest.TotalHours}h."
                });
            }
        }
    }
}
