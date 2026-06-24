-- Seed org chart structure into team_members
-- Safe to run: only inserts if table has fewer than 10 entries (clears test data first)

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM team_members) < 10 THEN
    DELETE FROM team_members;

    INSERT INTO team_members (name, positions, department, sub_department, context, email, phone, instagram, avatar_color, sort_order) VALUES

    -- Leadership
    ('Mantas Galdikas',  ARRAY['Co-Founder', 'Strategy', 'Media Buyer'],                  'Leadership', NULL,         'Strategy, budget, systems, booking, media buying', NULL, NULL, NULL, '#C5613D', 0),
    ('Ignas Žakas',      ARRAY['Co-Founder', 'Creative Director'],                         'Leadership', NULL,         'Creative direction, content, performance creative',  NULL, NULL, NULL, '#2D7DD2', 1),

    -- Operations
    ('Event Manager',    ARRAY['Event Manager'],                                            'Operations', NULL,         'Project manager for all events',                     NULL, NULL, NULL, '#3CAA6F', 10),
    ('Night Manager',    ARRAY['Night Manager'],                                            'Operations', NULL,         'Director on the night, volunteers sourcing',          NULL, NULL, NULL, '#3CAA6F', 11),
    ('Apsauga',          ARRAY['Security'],                                                 'Operations', NULL,         'Security on event nights',                           NULL, NULL, NULL, '#6B7280', 12),
    ('Media / Awareness',ARRAY['Media / Awareness'],                                        'Operations', NULL,         'On-site coverage and reach during events',           NULL, NULL, NULL, '#6B7280', 13),

    -- Booking
    ('Head Booker',      ARRAY['Head Booker'],                                              'Booking',    NULL,         'Artist booking and deal negotiations',               NULL, NULL, NULL, '#8B5CF6', 20),

    -- Hospitality
    ('Hosp. Manager',    ARRAY['Hospitality Manager'],                                      'Hospitality',NULL,         'Hosting artists and crew, hotel and transport',      NULL, NULL, NULL, '#E85D75', 30),

    -- Technical
    ('Technical Manager',ARRAY['Technical Manager'],                                        'Technical',  NULL,         'All technical, rider checks, setup coordination',    NULL, NULL, NULL, '#F59E0B', 40),
    ('Garsistas',        ARRAY['Sound Engineer'],                                           'Technical',  NULL,         'Live sound engineering',                             NULL, NULL, NULL, '#F59E0B', 41),
    ('Šviečistas',       ARRAY['Lighting Engineer'],                                        'Technical',  NULL,         'Live lighting engineering',                          NULL, NULL, NULL, '#F59E0B', 42),
    ('Dekoratorius',     ARRAY['Decorator'],                                                'Technical',  NULL,         'Decor and visual setup for events',                  NULL, NULL, NULL, '#F59E0B', 43),

    -- Graphic Design
    ('Grafinis dizaineris', ARRAY['Graphic Designer'],                                     'Graphic Design', NULL,     'Flyers, posters, visual identity',                   NULL, NULL, NULL, '#0F7270', 50),

    -- Creative – Media Team
    ('Fotografas',       ARRAY['Photographer'],                                             'Creative',   'Media Team', 'Event photography',                                  NULL, NULL, NULL, '#6B7280', 60),
    ('Videographer',     ARRAY['Videographer'],                                             'Creative',   'Media Team', 'Event videography',                                  NULL, NULL, NULL, '#6B7280', 61),
    ('Editor',           ARRAY['Video Editor'],                                             'Creative',   'Media Team', 'Video and content editing',                          NULL, NULL, NULL, '#6B7280', 62),

    -- Communications
    ('Komunikacijos Manager', ARRAY['Communications Manager'],                             'Communications', NULL,     'Planning, posting, copy, PR',                        NULL, NULL, NULL, '#C5613D', 70),

    -- Marketing – Digital (Mantas + Ignas appear here too)
    ('Ignas Žakas',      ARRAY['Perf. Creative & Editor'],                                 'Marketing',  'Digital',    'Performance creative and video editing for ads',     NULL, NULL, NULL, '#2D7DD2', 80),
    ('Mantas Galdikas',  ARRAY['Media Buyer'],                                             'Marketing',  'Digital',    'Paid media buying',                                  NULL, NULL, NULL, '#C5613D', 81),
    ('Influencer Marketing', ARRAY['Influencer Marketing'],                                'Marketing',  NULL,         'Influencer relations and collaborations',             NULL, NULL, NULL, '#F59E0B', 82),
    ('Sponsorių Manager',ARRAY['Sponsorship Manager'],                                     'Marketing',  NULL,         'Brand partnerships and sponsorship deals',           NULL, NULL, NULL, '#8B5CF6', 83);

  END IF;
END $$;
