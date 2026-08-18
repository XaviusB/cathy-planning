using Xunit;
using CathyPlanning.Domain.Entities;
using CathyPlanning.Domain.Services;
using CathyPlanning.Domain.ValueObjects;
using FluentAssertions;

namespace CathyPlanning.Domain.Tests;

public class ComplianceServiceTests
{
    private readonly ComplianceService _svc = new();

    private static PlanningSession CreateSession(int weekCount = 1) => new()
    {
        Rotation = new RotationDefinition { WeekCount = weekCount, StartDate = new DateTime(2024, 1, 1) },
        RestRules = new List<RestRule>
        {
            new() { Name = "Default", MinRestBetweenShifts = TimeSpan.FromHours(11), MinWeeklyRest = TimeSpan.FromHours(35) }
        }
    };

    [Fact]
    public void EmptySession_Returns_NoViolations()
    {
        var session = CreateSession();
        session.Employees.Add(new Employee { Id = Guid.NewGuid(), Name = "Alice" });
        var report = _svc.Evaluate(session);
        report.Violations.Should().BeEmpty();
        report.IsCompliant.Should().BeTrue();
    }

    [Fact]
    public void ShiftsTooClose_Produces_Error()
    {
        var session = CreateSession();
        var emp = new Employee { Id = Guid.NewGuid(), Name = "Bob" };
        session.Employees.Add(emp);

        // Two shifts only 8h apart (< 11h required)
        session.Shifts.Add(new ShiftAssignment { EmployeeId = emp.Id, Start = new DateTime(2024, 1, 1, 8, 0, 0), End = new DateTime(2024, 1, 1, 16, 0, 0) });
        session.Shifts.Add(new ShiftAssignment { EmployeeId = emp.Id, Start = new DateTime(2024, 1, 2, 0, 0, 0), End = new DateTime(2024, 1, 2, 8, 0, 0) });

        var report = _svc.Evaluate(session);
        report.Violations.Should().ContainSingle(v => v.Severity == ComplianceSeverity.Error);
        report.IsCompliant.Should().BeFalse();
    }

    [Fact]
    public void AdequateRest_Produces_NoViolation()
    {
        var session = CreateSession();
        var emp = new Employee { Id = Guid.NewGuid(), Name = "Carol" };
        session.Employees.Add(emp);

        // 16h rest between shifts - fine
        session.Shifts.Add(new ShiftAssignment { EmployeeId = emp.Id, Start = new DateTime(2024, 1, 1, 6, 0, 0), End = new DateTime(2024, 1, 1, 14, 0, 0) });
        session.Shifts.Add(new ShiftAssignment { EmployeeId = emp.Id, Start = new DateTime(2024, 1, 2, 6, 0, 0), End = new DateTime(2024, 1, 2, 14, 0, 0) });

        var report = _svc.Evaluate(session);
        report.Violations.Where(v => v.Severity == ComplianceSeverity.Error).Should().BeEmpty();
    }

    [Fact]
    public void HoursSummary_IsCorrect()
    {
        var session = CreateSession();
        var emp = new Employee { Id = Guid.NewGuid(), Name = "Dave" };
        session.Employees.Add(emp);

        session.Shifts.Add(new ShiftAssignment { EmployeeId = emp.Id, Start = new DateTime(2024, 1, 1, 8, 0, 0), End = new DateTime(2024, 1, 1, 16, 0, 0) });
        session.Shifts.Add(new ShiftAssignment { EmployeeId = emp.Id, Start = new DateTime(2024, 1, 3, 8, 0, 0), End = new DateTime(2024, 1, 3, 16, 0, 0) });

        var report = _svc.Evaluate(session);
        report.HoursSummaries.Should().ContainSingle(s => s.EmployeeId == emp.Id && Math.Abs(s.TotalHours - 16) < 0.01);
    }

    [Fact]
    public void PerEmployee_MinWeeklyRestHours_OverridesSessionDefault_WhenLower()
    {
        // Session default requires 35h weekly rest; employee overrides to 10h.
        // A shift pattern that violates 35h but not 10h should produce no violation.
        var session = CreateSession(weekCount: 2);
        var emp = new Employee { Id = Guid.NewGuid(), Name = "Grace", MinWeeklyRestHours = 10 };
        session.Employees.Add(emp);

        // Shifts every day from Mon–Sat (Jan 1–6), leaving only 16h gap max — violates 35h but not 10h
        for (int d = 0; d < 6; d++)
        {
            var start = new DateTime(2024, 1, 1).AddDays(d).AddHours(8);
            session.Shifts.Add(new ShiftAssignment { EmployeeId = emp.Id, Start = start, End = start.AddHours(8) });
        }

        var report = _svc.Evaluate(session);
        report.Violations.Where(v => v.Message.Contains("weekly rest")).Should().BeEmpty();
    }

    [Fact]
    public void PerEmployee_MinWeeklyRestHours_OverridesSessionDefault_WhenHigher()
    {
        // Session default requires 35h; employee overrides to 50h.
        // Shifts Mon–Sat leave a max gap of ~32h (last shift ends Sat 16:00, week ends Sun midnight = 32h).
        // 32h satisfies 35h default but NOT 50h override → should produce a violation.
        var session = CreateSession(weekCount: 2);
        var emp = new Employee { Id = Guid.NewGuid(), Name = "Henry", MinWeeklyRestHours = 50 };
        session.Employees.Add(emp);

        for (int d = 0; d < 6; d++)
        {
            var start = new DateTime(2024, 1, 1).AddDays(d).AddHours(8);
            session.Shifts.Add(new ShiftAssignment { EmployeeId = emp.Id, Start = start, End = start.AddHours(8) });
        }

        var report = _svc.Evaluate(session);
        report.Violations.Should().Contain(v => v.EmployeeId == emp.Id && v.Message.Contains("weekly rest"));
    }
}