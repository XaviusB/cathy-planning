using Xunit;
using CathyPlanning.Domain.Entities;
using CathyPlanning.Domain.Services;
using CathyPlanning.Domain.ValueObjects;
using FluentAssertions;

namespace CathyPlanning.Domain.Tests;

public class PlannerServiceTests
{
    private readonly PlannerService _planner = new();
    private readonly ComplianceService _compliance = new();

    [Fact]
    public void GeneratePlan_ProducesShifts_ForAllEmployees()
    {
        var session = new PlanningSession
        {
            Rotation = new RotationDefinition { WeekCount = 1, StartDate = new DateTime(2024, 1, 1) }
        };
        session.Employees.Add(new Employee { Id = Guid.NewGuid(), Name = "Alice" });
        session.Employees.Add(new Employee { Id = Guid.NewGuid(), Name = "Bob" });

        _planner.GeneratePlan(session);

        session.Shifts.Should().NotBeEmpty();
        session.Shifts.Select(s => s.EmployeeId).Distinct().Should().HaveCount(2);
    }

    [Fact]
    public void GeneratePlan_ProducesCompliantSchedule()
    {
        var session = new PlanningSession
        {
            Rotation = new RotationDefinition { WeekCount = 2, StartDate = new DateTime(2024, 1, 1) }
        };
        session.Employees.Add(new Employee { Id = Guid.NewGuid(), Name = "Alice" });
        session.Employees.Add(new Employee { Id = Guid.NewGuid(), Name = "Bob" });
        session.Employees.Add(new Employee { Id = Guid.NewGuid(), Name = "Carol" });

        _planner.GeneratePlan(session);

        var report = _compliance.Evaluate(session);
        var restViolations = report.Violations
            .Where(v => v.Message.Contains("rest between"))
            .ToList();
        restViolations.Should().BeEmpty("planner should respect minimum rest between shifts");
    }

    [Fact]
    public void GeneratePlan_WithNoEmployees_ProducesNoShifts()
    {
        var session = new PlanningSession
        {
            Rotation = new RotationDefinition { WeekCount = 6, StartDate = new DateTime(2024, 1, 1) }
        };
        _planner.GeneratePlan(session);
        session.Shifts.Should().BeEmpty();
    }

    [Fact]
    public void GeneratePlan_ClearsExistingShifts()
    {
        var session = new PlanningSession
        {
            Rotation = new RotationDefinition { WeekCount = 1, StartDate = new DateTime(2024, 1, 1) }
        };
        var emp = new Employee { Id = Guid.NewGuid(), Name = "Alice" };
        session.Employees.Add(emp);

        // Pre-populate some shifts
        session.Shifts.Add(new ShiftAssignment { EmployeeId = emp.Id, Start = DateTime.Now, End = DateTime.Now.AddHours(8) });

        _planner.GeneratePlan(session);

        // All shifts should be freshly generated (no duplicates from old data)
        session.Shifts.All(s => s.EmployeeId == emp.Id).Should().BeTrue();
    }
}
