import os
from playwright.sync_api import sync_playwright

def snap():
    artifact_dir = r"C:\Users\harsh\.gemini\antigravity\brain\2328e25e-3f7a-417b-8dfa-bb980cafee18"
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        page = context.new_page()
        page.goto("http://localhost:8000/index.html")
        page.wait_for_timeout(2500)
        
        # Scroll to view more button
        btn = page.locator(".view-more-container")
        btn.scroll_into_view_if_needed()
        page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(artifact_dir, "refine_index_button_focus.png"))
        browser.close()

if __name__ == "__main__":
    snap()
