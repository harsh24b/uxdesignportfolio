import os
from playwright.sync_api import sync_playwright

def test_stack():
    artifact_dir = r"C:\Users\harsh\.gemini\antigravity\brain\2328e25e-3f7a-417b-8dfa-bb980cafee18"
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.goto("http://localhost:8000/index.html")
        page.wait_for_timeout(2500)
        
        # Scroll positions
        # 1. Start of Work Section
        page.evaluate("window.scrollTo(0, 950)")
        page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(artifact_dir, "work_stack_step1_row1.png"))

        # 2. Scroll to Row 2 + Explore More Button
        page.evaluate("window.scrollTo(0, 1550)")
        page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(artifact_dir, "work_stack_step2_row2_and_btn.png"))

        # 3. Middle of Work Dwell (Button still visible)
        page.evaluate("window.scrollTo(0, 2150)")
        page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(artifact_dir, "work_stack_step3_dwell_btn_visible.png"))

        # 4. Approaching Experience Stacking
        page.evaluate("window.scrollTo(0, 2800)")
        page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(artifact_dir, "work_stack_step4_exp_incoming.png"))

        browser.close()
        print("Work stack test completed!")

if __name__ == "__main__":
    test_stack()
