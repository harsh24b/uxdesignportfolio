import os
from playwright.sync_api import sync_playwright

def run_tests():
    artifact_dir = r"C:\Users\harsh\.gemini\antigravity\brain\2328e25e-3f7a-417b-8dfa-bb980cafee18"
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # 1. Test index.html Work Section and Explore More Projects button & About Section
        print("Testing index.html...")
        page.goto("http://localhost:8000/index.html")
        page.wait_for_timeout(2500) # Wait for preloader reveal

        # Scroll to Work section
        work_section = page.locator("#work")
        work_section.scroll_into_view_if_needed()
        page.wait_for_timeout(1000)

        # Take screenshot of work section with Explore more projects button
        page.screenshot(path=os.path.join(artifact_dir, "refine_index_work_and_button.png"))

        # Scroll to About Section
        about_section = page.locator("#about")
        about_section.scroll_into_view_if_needed()
        page.wait_for_timeout(1000)
        page.screenshot(path=os.path.join(artifact_dir, "refine_index_about_grey_subtitles.png"))

        # Test scrolled navbar Work with me button
        page.screenshot(path=os.path.join(artifact_dir, "refine_index_scrolled_navbar.png"))

        # 2. Test work.html page
        print("Testing work.html...")
        page.goto("http://localhost:8000/work.html")
        page.wait_for_timeout(1500)
        page.screenshot(path=os.path.join(artifact_dir, "refine_work_page_top.png"))

        # Scroll down to see weapons card and contact section
        page.evaluate("window.scrollTo(0, document.body.scrollHeight * 0.5)")
        page.wait_for_timeout(1000)
        page.screenshot(path=os.path.join(artifact_dir, "refine_work_page_weapons_card.png"))

        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(1000)
        page.screenshot(path=os.path.join(artifact_dir, "refine_work_page_contact_section.png"))

        # 3. Test savw.html page
        print("Testing savw.html...")
        page.goto("http://localhost:8000/savw.html")
        page.wait_for_timeout(1500)
        page.screenshot(path=os.path.join(artifact_dir, "refine_savw_table.png"))

        # Scroll to slides to check 1px gap
        slides_sec = page.locator(".case-study-slides-container")
        slides_sec.scroll_into_view_if_needed()
        page.wait_for_timeout(1000)
        page.screenshot(path=os.path.join(artifact_dir, "refine_savw_slides_gap.png"))

        # 4. Test life-beyond-the-screen.html
        print("Testing life-beyond-the-screen.html...")
        page.goto("http://localhost:8000/life-beyond-the-screen.html")
        page.wait_for_timeout(1500)
        page.screenshot(path=os.path.join(artifact_dir, "refine_life_beyond_screen_tags.png"))

        browser.close()
        print("All tests completed successfully!")

if __name__ == "__main__":
    run_tests()
