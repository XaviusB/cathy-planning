.PHONY: build test run clean

DOTNET := dotnet
SOLUTION := CathyPlanning.sln

build:
	$(DOTNET) build $(SOLUTION)

run:
	$(DOTNET) run --project src/CathyPlanning.App/CathyPlanning.App.csproj

run-release:
	$(DOTNET) run --project src/CathyPlanning.App/CathyPlanning.App.csproj -c Release

test:
	$(DOTNET) test $(SOLUTION)

clean:
	$(DOTNET) clean $(SOLUTION)
