using System;
using System.Collections.Generic;
using Avalonia.Controls;
using Avalonia.Interactivity;
using CathyPlanning.Domain.Entities;

namespace CathyPlanning.App.Dialogs;

public enum EditShiftResult { None, Saved, Deleted }

public partial class EditShiftDialog : Window
{
    public EditShiftResult Result     { get; private set; } = EditShiftResult.None;
    public Guid   ResultEmployeeId    { get; private set; }
    public DateTime ResultStart       { get; private set; }
    public DateTime ResultEnd         { get; private set; }
    public string   ResultLabel       { get; private set; } = "Shift";

    private readonly List<Employee> _employees = new();
    private readonly ShiftAssignment? _shift;

    // Designer constructor
    public EditShiftDialog() { InitializeComponent(); }

    public EditShiftDialog(List<Employee> employees, ShiftAssignment shift)
    {
        _employees = employees;
        _shift     = shift;
        InitializeComponent();

        var cb = this.FindControl<ComboBox>("CbEmployee")!;
        int selIdx = 0;
        for (int i = 0; i < employees.Count; i++)
        {
            cb.Items.Add(employees[i].Name);
            if (employees[i].Id == shift.EmployeeId) selIdx = i;
        }
        cb.SelectedIndex = selIdx;

        this.FindControl<TextBox>("TxtStart")!.Text = shift.Start.ToString("yyyy-MM-dd HH:mm");
        this.FindControl<TextBox>("TxtEnd")!.Text   = shift.End.ToString("yyyy-MM-dd HH:mm");
        this.FindControl<TextBox>("TxtLabel")!.Text = shift.Label ?? "Shift";

        this.FindControl<Button>("BtnSave")!.Click   += OnSave;
        this.FindControl<Button>("BtnDelete")!.Click += OnDelete;
        this.FindControl<Button>("BtnCancel")!.Click += (_, _) => Close();
    }

    private void OnSave(object? sender, RoutedEventArgs e)
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

        ResultEmployeeId = _employees[cb.SelectedIndex].Id;
        ResultStart = s;
        ResultEnd   = en;
        ResultLabel = this.FindControl<TextBox>("TxtLabel")!.Text ?? "Shift";
        Result      = EditShiftResult.Saved;
        Close();
    }

    private void OnDelete(object? sender, RoutedEventArgs e)
    {
        Result = EditShiftResult.Deleted;
        Close();
    }

    private void ShowError(string msg)
    {
        var tb = this.FindControl<TextBlock>("TxtError")!;
        tb.Text      = msg;
        tb.IsVisible = true;
    }
}
