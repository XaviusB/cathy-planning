using System;
using System.Collections.Generic;
using Avalonia.Controls;
using Avalonia.Interactivity;
using CathyPlanning.Domain.Entities;

namespace CathyPlanning.App.Dialogs;

public partial class AssignShiftDialog : Window
{
    public Guid? SelectedEmployeeId { get; private set; }
    public DateTime ResultStart { get; private set; }
    public DateTime ResultEnd   { get; private set; }
    public string   ResultLabel { get; private set; } = "Shift";
    public bool     Confirmed   { get; private set; }

    private readonly List<Employee> _employees = new();

    // Designer constructor
    public AssignShiftDialog() { InitializeComponent(); }

    public AssignShiftDialog(List<Employee> employees, DateTime start, DateTime end)
    {
        _employees = employees;
        InitializeComponent();

        var cb = this.FindControl<ComboBox>("CbEmployee")!;
        foreach (var e in employees) cb.Items.Add(e.Name);
        if (employees.Count > 0) cb.SelectedIndex = 0;

        this.FindControl<TextBox>("TxtStart")!.Text = start.ToString("yyyy-MM-dd HH:mm");
        this.FindControl<TextBox>("TxtEnd")!.Text   = end.ToString("yyyy-MM-dd HH:mm");
        this.FindControl<TextBox>("TxtLabel")!.Text = "Shift";

        this.FindControl<Button>("BtnOk")!.Click     += OnOk;
        this.FindControl<Button>("BtnCancel")!.Click += (_, _) => Close();
    }

    private void OnOk(object? sender, RoutedEventArgs e)
    {
        var cb = this.FindControl<ComboBox>("CbEmployee")!;

        if (cb.SelectedIndex < 0 || cb.SelectedIndex >= _employees.Count)
        {
            ShowError("Please select an employee.");
            return;
        }

        if (!DateTime.TryParse(this.FindControl<TextBox>("TxtStart")!.Text, out var s))
        {
            ShowError("Invalid start date/time (use yyyy-MM-dd HH:mm).");
            return;
        }
        if (!DateTime.TryParse(this.FindControl<TextBox>("TxtEnd")!.Text, out var en))
        {
            ShowError("Invalid end date/time (use yyyy-MM-dd HH:mm).");
            return;
        }
        if (en <= s)
        {
            ShowError("End must be after start.");
            return;
        }

        SelectedEmployeeId = _employees[cb.SelectedIndex].Id;
        ResultStart = s;
        ResultEnd   = en;
        ResultLabel = this.FindControl<TextBox>("TxtLabel")!.Text ?? "Shift";
        Confirmed   = true;
        Close();
    }

    private void ShowError(string msg)
    {
        var tb = this.FindControl<TextBlock>("TxtError")!;
        tb.Text      = msg;
        tb.IsVisible = true;
    }
}
