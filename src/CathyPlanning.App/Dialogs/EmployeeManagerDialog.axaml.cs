using System;
using System.Linq;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Layout;
using CathyPlanning.App.ViewModels;
using CathyPlanning.Domain.Entities;

namespace CathyPlanning.App.Dialogs;

public partial class EmployeeManagerDialog : Window
{
    private readonly MainViewModel? _vm;

    // Designer constructor
    public EmployeeManagerDialog() { InitializeComponent(); }

    public EmployeeManagerDialog(MainViewModel vm)
    {
        _vm = vm;
        InitializeComponent();
        this.FindControl<Button>("BtnAdd")!.Click += OnAddClick;
        RebuildList();
    }

    private void RebuildList()
    {
        if (_vm == null) return;
        var panel = this.FindControl<StackPanel>("EmpList")!;
        panel.Children.Clear();

        // Header row
        panel.Children.Add(BuildRow(
            new TextBlock { Text = "Name",     FontWeight = Avalonia.Media.FontWeight.Bold, Width = 140 },
            new TextBlock { Text = "Role",     FontWeight = Avalonia.Media.FontWeight.Bold, Width = 120 },
            new TextBlock { Text = "Max h/wk", FontWeight = Avalonia.Media.FontWeight.Bold, Width = 80  },
            new TextBlock { Width = 130 }));

        foreach (var emp in _vm.Employees.ToList())
        {
            var nameTb  = new TextBox { Text = emp.Name,                          Width = 140 };
            var roleTb  = new TextBox { Text = emp.Role,                          Width = 120 };
            var hoursTb = new TextBox { Text = emp.MaxWeeklyHours.ToString("F0"), Width = 80  };
            var saveBtn = new Button  { Content = "Save",   Width = 56, Margin = new Thickness(0, 0, 4, 0) };
            var delBtn  = new Button  { Content = "Remove", Width = 66 };

            var capturedId = emp.Id;
            saveBtn.Click += (_, _) =>
            {
                if (!double.TryParse(hoursTb.Text, out var h)) h = 40;
                _vm.UpdateEmployee(capturedId, nameTb.Text ?? "", roleTb.Text ?? "", h);
            };
            delBtn.Click += (_, _) =>
            {
                _vm.RemoveEmployee(capturedId);
                RebuildList();
            };

            panel.Children.Add(BuildRow(nameTb, roleTb, hoursTb, BuildHStack(saveBtn, delBtn)));
        }
    }

    private void OnAddClick(object? sender, RoutedEventArgs e)
    {
        if (_vm == null) return;
        var name  = this.FindControl<TextBox>("TxtNewName")!.Text  ?? "";
        var role  = this.FindControl<TextBox>("TxtNewRole")!.Text  ?? "";
        var hText = this.FindControl<TextBox>("TxtNewHours")!.Text ?? "40";
        if (!double.TryParse(hText, out var h)) h = 40;

        if (string.IsNullOrWhiteSpace(name)) return;

        _vm.AddEmployee(name, role, h);

        this.FindControl<TextBox>("TxtNewName")!.Text  = "";
        this.FindControl<TextBox>("TxtNewRole")!.Text  = "";
        this.FindControl<TextBox>("TxtNewHours")!.Text = "";
        RebuildList();
    }

    private static StackPanel BuildRow(params Control[] controls)
    {
        var row = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            Spacing     = 6,
            Margin      = new Thickness(0, 2)
        };
        foreach (var c in controls) row.Children.Add(c);
        return row;
    }

    private static StackPanel BuildHStack(params Control[] controls)
    {
        var sp = new StackPanel { Orientation = Orientation.Horizontal };
        foreach (var c in controls) sp.Children.Add(c);
        return sp;
    }
}
