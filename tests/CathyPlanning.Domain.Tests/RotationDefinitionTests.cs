using Xunit;
using CathyPlanning.Domain.ValueObjects;
using FluentAssertions;

namespace CathyPlanning.Domain.Tests;

public class RotationDefinitionTests
{
    [Theory]
    [InlineData(6)]
    [InlineData(4)]
    [InlineData(1)]
    public void EndDate_EqualsStartDate_Plus_WeekCount_Weeks(int weekCount)
    {
        var start = new DateTime(2024, 3, 1);
        var rotation = new RotationDefinition { WeekCount = weekCount, StartDate = start };
        rotation.EndDate.Should().Be(start.AddDays(weekCount * 7));
    }
}
