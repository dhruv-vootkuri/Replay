import replay

@replay.tool(safe=True)
def get_capital(country: str) -> str:
    """Return the capital city of a country."""
    capitals = {
        "france": "Paris", "germany": "Berlin", "japan": "Tokyo",
        "brazil": "Brasilia",
        "zorblax": "Blorbis",  # fictional -> forces a real tool call
    }
    return capitals.get(country.lower(), f"Unknown capital for {country}")
@replay.tool(safe=True)
def get_population(city: str) -> str:
    """Return the approximate population of a city."""
    populations = {
        "paris": "2.1M", "berlin": "3.7M", "tokyo": "13.9M",
        "brasilia": "3.1M", "blorbis": "4.7M", "osaka": "2.7M",
    }
    return populations.get(city.lower(), f"Unknown population for {city}")
@replay.tool(safe=True)
def get_currency(country: str) -> str:
    """Return the ISO currency code used by a country."""
    currencies = {
        "france": "EUR", "germany": "EUR", "japan": "JPY",
        "brazil": "BRL", "zorblax": "ZBX",
    }
    return currencies.get(country.lower(), f"Unknown currency for {country}")
@replay.tool(safe=True)
def convert_from_usd(amount: float, to_currency: str) -> str:
    """Convert an amount in USD into the given currency code."""
    usd_rates = {"EUR": 0.92, "JPY": 157.0, "BRL": 5.4, "ZBX": 0.5, "USD": 1.0}
    rate = usd_rates.get(to_currency.upper())
    if rate is None:
        return f"No exchange rate for {to_currency}"
    return f"{amount} USD = {amount * rate:.2f} {to_currency.upper()}"
@replay.tool(safe=True)
def get_weather(city: str) -> str:
    """Return the current weather in a city."""
    weather = {
        "paris": "14°C, light rain", "berlin": "11°C, cloudy",
        "tokyo": "22°C, clear", "brasilia": "28°C, humid",
        "blorbis": "31°C, three suns", "osaka": "23°C, breezy",
    }
    return weather.get(city.lower(), f"No weather data for {city}")