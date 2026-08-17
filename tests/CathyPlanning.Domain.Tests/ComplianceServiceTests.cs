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
    public void MultipleEmployees_EachEvaluatedIndependently()
    {
        var session = CreateSession();
        var emp1 = new Employee { Id = Guid.NewGuid(), Name = "Eve" };
        var emp2 = new Employee { Id = Guid.NewGuid(), Name = "Frank" };
        session.Employees.AddRange(new[] { emp1, emp2 });

        // emp1 has a violation
        session.Shifts.Add(new ShiftAssignment { EmployeeId = emp1.Id, Start = new DateTime(2024, 1, 1, 8, 0, 0), End = new DateTime(2024, 1, 1, 16, 0, 0) });
        session.Shifts.Add(new ShiftAssignment { EmployeeId = emp1.Id, Start = new DateTime(2024, 1, 2, 0, 0, 0), End = new DateTime(2024, 1, 2, 8, 0, 0) });

        // emp2 is fine
        session.Shifts.Add(new ShiftAssignment { EmployeeId = emp2.Id, Start = new DateTime(2024, 1, 1, 6, 0, 0), End = new DateTime(2024, 1, 1, 14, 0, 0) });

        var report = _svc.Evaluate(session);
        report.Violations.Should().OnlyContain(v => v.EmployeeId == emp1.Id);
    }
}
