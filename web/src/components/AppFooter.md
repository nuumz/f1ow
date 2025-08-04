# AppFooter - Common Footer System

A flexible footer component system that can be configured for different page types across the f1ow application.

## Features

- **Multiple Variants**: Dashboard, Full, Minimal
- **Conditional Rendering**: Show/hide sections based on configuration
- **Type Safe**: Full TypeScript support with comprehensive interfaces
- **Responsive Design**: Mobile-friendly layouts
- **Customizable**: Brand text, descriptions, and styling
- **Statistics Support**: Dynamic stats display for dashboard pages

## Usage

### Basic Usage

```tsx
import AppFooter from './components/AppFooter'
import { FOOTER_CONFIGS } from './hooks/useFooter'

// Dashboard page with stats
<AppFooter 
  config={FOOTER_CONFIGS.DASHBOARD}
  stats={{
    totalExecutions: 1547,
    successRate: 91
  }}
/>

// Designer page with no footer
<AppFooter config={FOOTER_CONFIGS.DESIGNER} />

// Regular page with full footer
<AppFooter config={FOOTER_CONFIGS.PAGE} />
```

### Predefined Configurations

```tsx
// Available predefined configs
FOOTER_CONFIGS.DASHBOARD     // Full featured with stats
FOOTER_CONFIGS.DESIGNER      // Disabled (no footer)
FOOTER_CONFIGS.DESIGNER_MINIMAL // Minimal version
FOOTER_CONFIGS.PAGE          // Full without stats
FOOTER_CONFIGS.MINIMAL       // Minimal footer only
```

### Custom Configuration

```tsx
<AppFooter 
  config={{
    enabled: true,
    variant: 'full',
    showStats: false,
    showNavigation: true,
    showBrand: true,
    brandText: 'Custom Brand',
    description: 'Custom description text',
    className: 'custom-styles'
  }}
  stats={{
    customStats: [
      { label: 'Users', value: 1250 },
      { label: 'Projects', value: 45 }
    ]
  }}
/>
```

## Configuration Options

### FooterConfig Interface

```tsx
interface FooterConfig {
  enabled?: boolean          // Show/hide footer
  variant?: 'dashboard' | 'minimal' | 'full'
  showStats?: boolean        // Show statistics section
  showNavigation?: boolean   // Show navigation links
  showBrand?: boolean        // Show brand section
  brandText?: string         // Custom brand text
  description?: string       // Custom description
  className?: string         // Additional CSS classes
}
```

### FooterStats Interface

```tsx
interface FooterStats {
  totalExecutions?: number   // Total executions count
  successRate?: number       // Success rate percentage
  customStats?: Array<{      // Custom statistics
    label: string
    value: string | number
  }>
}
```

## Variants

### Dashboard Variant
- Full-featured footer with 3-column layout
- Brand section with logo and description
- Navigation links organized in sections
- Statistics section with live data
- Professional styling with gradients

### Full Variant
- Complete footer for regular pages
- 3-column layout with brand and navigation
- No statistics section
- Comprehensive navigation links

### Minimal Variant
- Simple single-line footer
- Copyright and version info only
- Minimal spacing and styling
- Perfect for focused pages like designer

## Page Type Examples

### Dashboard Page
```tsx
<AppFooter 
  config={FOOTER_CONFIGS.DASHBOARD}
  stats={{
    totalExecutions: stats.totalExecutions,
    successRate: calculateSuccessRate()
  }}
/>
```

### Designer Page (No Footer)
```tsx
<AppFooter config={FOOTER_CONFIGS.DESIGNER} />
```

### Designer Page (Minimal Footer)
```tsx
<AppFooter config={FOOTER_CONFIGS.DESIGNER_MINIMAL} />
```

### Documentation Page
```tsx
<AppFooter 
  config={{
    ...FOOTER_CONFIGS.PAGE,
    brandText: 'f1ow Documentation',
    description: 'Comprehensive guides and API references.'
  }}
/>
```

### Admin/Settings Page
```tsx
<AppFooter 
  config={{
    variant: 'minimal',
    showBrand: true,
    brandText: 'f1ow Admin Panel'
  }}
/>
```

## Styling

The footer uses CSS classes with BEM-like naming:

```scss
.app-footer                    // Base footer styles
.app-footer--dashboard         // Dashboard variant
.app-footer--full             // Full variant  
.app-footer--minimal          // Minimal variant
.footer-content               // Main content area
.footer-left                  // Brand section
.footer-center                // Navigation section
.footer-right                 // Statistics section
.footer-bottom                // Copyright section
```

## Best Practices

1. **Use Predefined Configs**: Start with `FOOTER_CONFIGS` constants
2. **Conditional Stats**: Only pass stats data when needed
3. **Page-Specific Customization**: Override specific properties for custom needs
4. **Performance**: Footer re-renders only when props change
5. **Accessibility**: All links include proper navigation structure

## Migration from DashboardFooter

Replace old DashboardFooter usage:

```tsx
// Old
<DashboardFooter 
  totalExecutions={stats.totalExecutions}
  successRate={calculateSuccessRate()}
/>

// New
<AppFooter 
  config={FOOTER_CONFIGS.DASHBOARD}
  stats={{
    totalExecutions: stats.totalExecutions,
    successRate: calculateSuccessRate()
  }}
/>
```
