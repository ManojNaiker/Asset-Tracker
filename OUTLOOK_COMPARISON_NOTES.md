# UI Difference Analysis: Current App vs. Microsoft Outlook

Based on the comparison between the current application UI (image_1771310848684.png) and the Microsoft Outlook interface (image_1771310905153.png), here are the key differences and recommendations for alignment.

## 1. Color Palette & Theming
*   **Outlook (Reference):**
    *   **Dark Mode:** Uses a deep charcoal/black background (`#111111`) with subtle dark grey borders. Primary actions use a vibrant blue (`#0078d4`). Sidebar is slightly darker than the main content area.
    *   **Light Mode:** Pure white background with light grey borders (`#edebe9`).
*   **Current App:**
    *   Uses a slightly more "navy" blue-tinted dark mode. The primary blue is a bit more saturated.
*   **Recommendation:** Adjust the `--background` and `--sidebar` colors in `index.css` to be slightly more neutral/charcoal rather than navy.

## 2. Layout & Density
*   **Outlook (Reference):**
    *   High information density.
    *   Top ribbon/toolbar for major actions (Home, Send/Receive, etc.).
    *   Multi-pane layout: Navigation (Folders) -> List (Emails) -> Content (Reading Pane).
    *   Icons are smaller and more consistent in weight.
*   **Current App:**
    *   More modern "web app" spacing (breathable).
    *   Traditional left-sidebar navigation.
    *   Single main view (Asset List table).
*   **Recommendation:** If mimicking Outlook's workflow, consider implementing a "ribbon" style header for bulk actions and a multi-pane view for details instead of a flat table.

## 3. Navigation (Sidebar)
*   **Outlook (Reference):**
    *   Minimalist left-most bar for App switching (Mail, Calendar, People).
    *   Secondary sidebar for folder hierarchy with clear unread counts/badges.
    *   Active states are indicated by a subtle background change and a vertical primary color bar on the left edge.
*   **Current App:**
    *   Standard vertical navigation with icons and labels.
    *   Active state uses a solid blue background pill.
*   **Recommendation:** Change the active sidebar item style to use a subtle background with a 3px vertical "Outlook blue" indicator on the far left.

## 4. Typography & Icons
*   **Outlook (Reference):**
    *   Uses 'Segoe UI' (Windows) or 'San Francisco' (Mac).
    *   Iconography is very thin and minimalist (Fluent UI System Icons).
*   **Current App:**
    *   Uses 'Inter' and 'Poppins'.
    *   Lucide icons are slightly bolder.
*   **Recommendation:** Keep 'Inter' as it's a great web alternative, but ensure font weights for secondary text are lightened to match Outlook's hierarchy.

## 5. UI Components (Cards & Tables)
*   **Outlook (Reference):**
    *   Tables have very subtle borders, often just a bottom border.
    *   Headers are distinct but not overly heavy.
*   **Current App:**
    *   The Asset table is contained within a white card with a full border.
*   **Recommendation:** Remove the high-contrast card border for the table container and use a more integrated design where the table list feels part of the background, separated by thin grey dividers.

---
*Note: The current "Outlook-inspired" theme I applied has moved the colors closer to these values, but layout changes would require architectural adjustments to the components.*