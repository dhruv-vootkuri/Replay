import replay

@replay.tool(safe=True)
def get_capital(country: str) -> str:
    """Returns the capital city of a country."""
    capitals = {
        "france": "Paris",
        "germany": "Berlin",
        "japan": "Tokyo",
        "brazil": "Brasilia",
        "zorblax": "Blorbis"
    }
    return capitals.get(country.lower(), f"Unknown capital for {country}")
@replay.tool(safe=True)
def get_population(city: str) -> str:
    """Returns the approximate population of a city."""
    populations = {
        "paris": "2.1 million",
        "berlin": "3.7 million",
        "tokyo": "13.9 million",
        "brasilia": "3.1 million",
        "blorbis": "4.7 million",
        "quorblax city": "9.2 million"
    }
    return populations.get(city.lower(), f"Unknown population for {city}")