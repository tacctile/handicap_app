/**
 * Algorithm Context Tests
 *
 * Validates that the algorithm context constants contain correct values
 * from ALGORITHM_REFERENCE.md for AI prompt injection.
 */

import { describe, it, expect } from 'vitest';
import {
  ALGORITHM_CONTEXT,
  ALGORITHM_CONTEXT_COMPACT,
  PACE_CONTEXT,
  TRIP_TROUBLE_CONTEXT,
  FIELD_SPREAD_CONTEXT,
  VULNERABLE_FAVORITE_CONTEXT,
} from '../algorithmContext';

describe('ALGORITHM_CONTEXT', () => {
  describe('Version and Score Validation', () => {
    it('should contain algorithm version v3.6', () => {
      expect(ALGORITHM_CONTEXT).toContain('v3.6');
    });

    it('should contain correct base score total of 328', () => {
      expect(ALGORITHM_CONTEXT).toContain('328');
      // Should NOT contain the old incorrect value
      expect(ALGORITHM_CONTEXT).not.toContain('331');
    });

    it('should contain correct max final score of 368', () => {
      expect(ALGORITHM_CONTEXT).toContain('368');
    });

    it('should contain overlay cap of ±40', () => {
      expect(ALGORITHM_CONTEXT).toContain('±40');
    });
  });

  describe('Tier Thresholds', () => {
    it('should contain Tier 1 threshold of 180+', () => {
      expect(ALGORITHM_CONTEXT).toContain('180+');
    });

    it('should contain Tier 2 range 160-179', () => {
      expect(ALGORITHM_CONTEXT).toContain('160-179');
    });

    it('should contain Tier 3 range 140-159', () => {
      expect(ALGORITHM_CONTEXT).toContain('140-159');
    });

    it('should contain Diamond Check range 120-139', () => {
      expect(ALGORITHM_CONTEXT).toContain('120-139');
    });

    it('should contain Pass threshold <120', () => {
      expect(ALGORITHM_CONTEXT).toContain('<120');
    });
  });

  describe('Confidence Levels', () => {
    it('should contain HIGH confidence threshold 80-100%', () => {
      expect(ALGORITHM_CONTEXT).toContain('80-100%');
    });

    it('should contain MEDIUM confidence threshold 60-79%', () => {
      expect(ALGORITHM_CONTEXT).toContain('60-79%');
    });

    it('should contain LOW confidence threshold <60%', () => {
      expect(ALGORITHM_CONTEXT).toContain('<60%');
    });

    it('should contain 15% penalty for LOW confidence', () => {
      expect(ALGORITHM_CONTEXT).toContain('15%');
      expect(ALGORITHM_CONTEXT).toContain('penalty');
    });
  });

  describe('Scoring Categories', () => {
    it('should contain Speed Figures at 90 pts', () => {
      expect(ALGORITHM_CONTEXT).toContain('Speed Figures');
      expect(ALGORITHM_CONTEXT).toContain('90');
    });

    it('should contain Form at 50 pts', () => {
      expect(ALGORITHM_CONTEXT).toContain('Form');
      expect(ALGORITHM_CONTEXT).toContain('50');
    });

    it('should contain Pace at 45 pts', () => {
      expect(ALGORITHM_CONTEXT).toContain('Pace');
      expect(ALGORITHM_CONTEXT).toContain('45');
    });

    it('should contain Class at 32 pts', () => {
      expect(ALGORITHM_CONTEXT).toContain('Class');
      expect(ALGORITHM_CONTEXT).toContain('32');
    });

    it('should contain Connections at 27 pts', () => {
      expect(ALGORITHM_CONTEXT).toContain('Connections');
      expect(ALGORITHM_CONTEXT).toContain('27');
    });
  });

  describe('Overlay Sections', () => {
    it('should contain Pace Dynamics overlay ±10', () => {
      expect(ALGORITHM_CONTEXT).toContain('Pace Dynamics');
      expect(ALGORITHM_CONTEXT).toContain('±10');
    });

    it('should contain Form Cycle overlay ±15', () => {
      expect(ALGORITHM_CONTEXT).toContain('Form Cycle');
      expect(ALGORITHM_CONTEXT).toContain('±15');
    });

    it('should contain Trip Analysis overlay ±10', () => {
      expect(ALGORITHM_CONTEXT).toContain('Trip Analysis');
    });
  });

  describe('Edge Cases', () => {
    it('should contain Diamond in the Rough protocol', () => {
      expect(ALGORITHM_CONTEXT).toContain('Diamond');
      expect(ALGORITHM_CONTEXT).toContain('200%');
    });

    it('should contain Lightly Raced protocol (<8 starts)', () => {
      expect(ALGORITHM_CONTEXT).toContain('Lightly Raced');
      expect(ALGORITHM_CONTEXT).toContain('<8');
    });

    it('should contain Nuclear Longshot protocol (25/1+)', () => {
      expect(ALGORITHM_CONTEXT).toContain('Nuclear Longshot');
      expect(ALGORITHM_CONTEXT).toContain('25/1');
    });
  });
});

describe('ALGORITHM_CONTEXT_COMPACT', () => {
  it('should contain base score 328', () => {
    expect(ALGORITHM_CONTEXT_COMPACT).toContain('328');
  });

  it('should contain all tier thresholds', () => {
    expect(ALGORITHM_CONTEXT_COMPACT).toContain('180+');
    expect(ALGORITHM_CONTEXT_COMPACT).toContain('160-179');
    expect(ALGORITHM_CONTEXT_COMPACT).toContain('140-159');
    expect(ALGORITHM_CONTEXT_COMPACT).toContain('120-139');
    expect(ALGORITHM_CONTEXT_COMPACT).toContain('<120');
  });

  it('should contain confidence levels with 15% penalty', () => {
    expect(ALGORITHM_CONTEXT_COMPACT).toContain('HIGH');
    expect(ALGORITHM_CONTEXT_COMPACT).toContain('MEDIUM');
    expect(ALGORITHM_CONTEXT_COMPACT).toContain('LOW');
    expect(ALGORITHM_CONTEXT_COMPACT).toContain('15%');
  });
});

describe('Specialist Bot Contexts', () => {
  describe('PACE_CONTEXT', () => {
    it('should contain pace scoring of 45 pts', () => {
      expect(PACE_CONTEXT).toContain('45');
    });

    it('should contain overlay ±10', () => {
      expect(PACE_CONTEXT).toContain('±10');
    });

    it('should mention speed duel and lone speed', () => {
      expect(PACE_CONTEXT).toContain('Speed duel');
      expect(PACE_CONTEXT).toContain('Lone speed');
    });
  });

  describe('TRIP_TROUBLE_CONTEXT', () => {
    it('should contain overlay ±10', () => {
      expect(TRIP_TROUBLE_CONTEXT).toContain('±10');
    });

    it('should mention trip trouble keywords', () => {
      expect(TRIP_TROUBLE_CONTEXT).toContain('blocked');
      expect(TRIP_TROUBLE_CONTEXT).toContain('checked');
    });
  });

  describe('FIELD_SPREAD_CONTEXT', () => {
    it('should contain tier thresholds', () => {
      expect(FIELD_SPREAD_CONTEXT).toContain('180+');
      expect(FIELD_SPREAD_CONTEXT).toContain('160-179');
      expect(FIELD_SPREAD_CONTEXT).toContain('140-159');
    });

    it('should mention SEPARATED, TIGHT field types', () => {
      expect(FIELD_SPREAD_CONTEXT).toContain('SEPARATED');
      expect(FIELD_SPREAD_CONTEXT).toContain('TIGHT');
    });
  });

  describe('VULNERABLE_FAVORITE_CONTEXT', () => {
    it('should contain Tier 1 threshold 180+', () => {
      expect(VULNERABLE_FAVORITE_CONTEXT).toContain('180+');
    });

    it('should contain confidence levels', () => {
      expect(VULNERABLE_FAVORITE_CONTEXT).toContain('HIGH');
      expect(VULNERABLE_FAVORITE_CONTEXT).toContain('MEDIUM');
      expect(VULNERABLE_FAVORITE_CONTEXT).toContain('LOW');
    });

    it('should contain 15% penalty', () => {
      expect(VULNERABLE_FAVORITE_CONTEXT).toContain('15%');
    });
  });
});
