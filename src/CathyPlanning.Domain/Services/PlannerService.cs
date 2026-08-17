using CathyPlanning.Domain.Entities;
using CathyPlanning.Domain.ValueObjects;

namespace CathyPlanning.Domain.Services;

/// <summary>
/// Stub planner: generates a simple round-robin shift assignment across the rotation period.
/// Deterministic and respects MinRestBetweenShifts from the first rest rule.
/// </summary>
public class PlannerService
{
    private static readonly TimeSpan DefaultShiftDuration = TimeSpan.FromHours(8);

    public void GeneratePlan(PlanningSession session)
    {
        session.Shifts.Clear();

        if (!session.Employees.Any()) return;

        var restRule = session.RestRules.FirstOrDefault() ?? new RestRule();
        var minGap = restRule.MinRestBetweenShifts;

        var startDate = session.Rotation.StartDate.Date;
        var endDate = session.Rotation.EndDate.Date;

        int employeeIndex = 0;
        for (var day = startDate; day < endDate; day = day.AddDays(1))
        {
            var employee = session.Employees[employeeIndex % session.Employees.Count];
            employeeIndex++;

            // Morning shift 08:00-16:00 by default
            var shiftStart = day.AddHours(8);
            var shiftEnd = shiftStart + DefaultShiftDuration;

            // Check rest against last shift for this employee
            var lastShift = session.Shifts
                .Where(s => s.EmployeeId == employee.Id)
                .OrderByDescending(s => s.End)
                .FirstOrDefault();

            if (lastShift != null && (shiftStart - lastShift.End) < minGap)
                continue; // Skip day to respect rest

            session.Shifts.Add(new ShiftAssignment
            {
                EmployeeId = employee.Id,
                Start = shiftStart,
                End = shiftEnd,
                Label = "Shift"
            });
        }
    }
}
