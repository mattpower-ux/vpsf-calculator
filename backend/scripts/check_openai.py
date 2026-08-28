import httpx

from integration_env import load_backend_env, require_env


def main() -> None:
    load_backend_env()
    api_key = require_env("OPENAI_API_KEY")

    response = httpx.get(
        "https://api.openai.com/v1/models",
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=15,
    )
    response.raise_for_status()

    print("OpenAI OK")
    print("API key authenticated successfully.")


if __name__ == "__main__":
    main()
