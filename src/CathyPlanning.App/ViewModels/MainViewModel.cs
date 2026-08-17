using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Runtime.CompilerServices;
using CathyPlanning.Domain.Entities;
using CathyPlanning.Domain.Services;
using CathyPlanning.Domain.ValueObjects;

namespace CathyPlanning.App.ViewModels;

public class MainViewModel : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;
    private void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));

    private PlanningSession _session;
    private readonly ComplianceService _complianceService = new();
    private readonly PlannerService _plannerService = new();

    private string _complianceSummary = string.Empty;
    private string _hoursSummary = string.Empty;
    private DateTime _displayWeekStart;

    public MainViewModel()
    {
        _session = CreateDefaultSession();
        _displayWeekStart = _session.Rotation.StartDate;
        RefreshSummaries();
    }

    public PlanningSession Session => _session;

    public DateTime DisplayWeekStart
    {
        get => _displayWeekStart;
        set { _displayWeekStart = value; OnPropertyChanged(); OnPropertyChanged(nameof(WeekLabel)); }
    }

    public string WeekLabel =>
        $"Week of {_displayWeekStart:MMM dd, yyyy}  –  {_displayWeekStart.AddDays(6):MMM dd, yyyy}";

    public string HoursSummary
    {
        get => _hoursSummary;
        private set { _hoursSummary = value; OnPropertyChanged(); }
    }

    public string ComplianceSummary
    {
        get => _complianceSummary;
        private set { _complianceSummary = value; OnPropertyChanged(); }
    }

    public List<Employee> Employees => _session.Employees;

    public List<ShiftAssignment> ShiftsForWeek(DateTime weekStart)
    {
        var weekEnd = weekStart.AddDays(7);
        return _session.Shifts
            .Where(s => s.Start < weekEnd && s.End > weekStart)
            .ToList();
    }

    public void PreviousWeek()
    {
        DisplayWeekStart = DisplayWeekStart.AddDays(-7);
        OnPropertyChanged(nameof(ShiftsChangedMarker));
    }

    public void NextWeek()
    {
        DisplayWeekStart = DisplayWeekStart.AddDays(7);
        OnPropertyChanged(nameof(ShiftsChangedMarker));
    }

    // Dummy prop to trigger calendar refresh
    public int ShiftsChangedMarker { get; private set; }

    public void MoveShift(ShiftAssignment shift, DateTime newStart)
    {
        var duration = shift.Duration;
        shift.Start = newStart;
        shift.End = newStart + duration;
        RefreshSummaries();
        OnPropertyChanged(nameof(ShiftsChangedMarker));
    }

    public void ResizeShift(ShiftAssignment shift, DateTime newEnd)
    {
        if (newEnd > shift.Start.AddMinutes(30))
        {
            shift.End = newEnd;
            RefreshSummaries();
            OnPropertyChanged(nameof(ShiftsChangedMarker));
        }
    }

    public void GeneratePlan()
    {
        _plannerService.GeneratePlan(_session);
        RefreshSummaries();
        OnPropertyChanged(nameof(ShiftsChangedMarker));
    }

    public void LoadSession(PlanningSession session)
    {
        _session = session;
        _displayWeekStart = session.Rotation.StartDate;
        OnPropertyChanged(nameof(Session));
        OnPropertyChanged(nameof(Employees));
        OnPropertyChanged(nameof(WeekLabel));
        OnPropertyChanged(nameof(ShiftsChangedMarker));
        RefreshSummaries();
    }

    public void RefreshSummaries()
    {
        var report = _complianceService.Evaluate(_session);

        var hours = string.Join("\n", report.HoursSummaries.Select(s =>
            $"{s.EmployeeName}: {s.TotalHours:F1}h / {s.MaxWeeklyHours}h max"));

        HoursSummary = string.IsNullOrEmpty(hours) ? "No employees." : hours;

        if (!report.Violations.Any())
        {
            ComplianceSummary = "✅ No violations.";
        }
        else
        {
            ComplianceSummary = string.Join("\n", report.Violations.Select(v =>
                $"{(v.Severity == Domain.Services.ComplianceSeverity.Error ? "❌" : "⚠️")} {v.EmployeeName}: {v.Message}"));
        }
    }

    private static PlanningSession CreateDefaultSession()
    {
        var emp1 = new Employee { Name = "Alice", Role = "Nurse", MaxWeeklyHours = 40 };
        var emp2 = new Employee { Name = "Bob", Role = "Doctor", MaxWeeklyHours = 48 };

        return new PlanningSession
        {
            Name = "Demo Planning",
            Rotation = new RotationDefinition { WeekCount = 6, StartDate = DateTime.Today.AddDays(-(int)DateTime.Today.DayOfWeek + 1) },
            Employees = new List<Employee> { emp1, emp2 }
        };
    }
}
