import type { FooterConfig } from '../components/AppFooter'

interface UseFooterOptions {
  /** Default footer configuration */
  defaultConfig?: FooterConfig
}

/**
 * Hook for managing footer configuration across different pages
 * 
 * @param options - Configuration options
 * @returns Footer configuration helpers
 */
export function useFooter(options: UseFooterOptions = {}) {
  const { defaultConfig = { enabled: true, variant: 'full' } } = options

  // Predefined configurations for different page types
  const footerConfigs = {
    // Dashboard page - full featured footer with stats
    dashboard: {
      enabled: true,
      variant: 'dashboard' as const,
      showStats: true,
      showNavigation: true,
      showBrand: true,
    },

    // Designer page - minimal or no footer
    designer: {
      enabled: false, // No footer for designer page
    },

    // Designer with minimal footer (alternative)
    designerMinimal: {
      enabled: true,
      variant: 'minimal' as const,
      showStats: false,
      showNavigation: false,
      showBrand: false,
    },

    // Regular pages - full footer without stats
    page: {
      enabled: true,
      variant: 'full' as const,
      showStats: false,
      showNavigation: true,
      showBrand: true,
    },

    // Documentation pages
    docs: {
      enabled: true,
      variant: 'full' as const,
      showStats: false,
      showNavigation: true,
      showBrand: true,
      brandText: 'f1ow Documentation',
      description: 'Comprehensive guides and API references for f1ow Workflow Engine.',
    },

    // Settings or admin pages
    admin: {
      enabled: true,
      variant: 'minimal' as const,
      showStats: false,
      showNavigation: false,
      showBrand: true,
      brandText: 'f1ow Admin',
    },

    // Landing or marketing pages
    landing: {
      enabled: true,
      variant: 'full' as const,
      showStats: false,
      showNavigation: true,
      showBrand: true,
      description: 'Transform your business processes with powerful workflow automation.',
    },
  }

  /**
   * Get footer configuration for specific page type
   * @param pageType - Type of page
   * @returns Footer configuration
   */
  const getFooterConfig = (pageType: keyof typeof footerConfigs): FooterConfig => {
    return { ...defaultConfig, ...footerConfigs[pageType] }
  }

  /**
   * Create custom footer configuration
   * @param config - Custom configuration
   * @returns Merged footer configuration
   */
  const createFooterConfig = (config: Partial<FooterConfig>): FooterConfig => {
    return { ...defaultConfig, ...config }
  }

  return {
    footerConfigs,
    getFooterConfig,
    createFooterConfig,
  }
}

// Export predefined configurations for direct use
export const FOOTER_CONFIGS = {
  DASHBOARD: {
    enabled: true,
    variant: 'dashboard' as const,
    showStats: true,
    showNavigation: true,
    showBrand: true,
  },
  DESIGNER: {
    enabled: false,
  },
  DESIGNER_MINIMAL: {
    enabled: true,
    variant: 'minimal' as const,
  },
  PAGE: {
    enabled: true,
    variant: 'full' as const,
    showStats: false,
  },
  MINIMAL: {
    enabled: true,
    variant: 'minimal' as const,
    showStats: false,
    showNavigation: false,
  },
} as const
