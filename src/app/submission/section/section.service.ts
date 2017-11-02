import { Injectable, ViewContainerRef } from '@angular/core';

import { Observable } from 'rxjs/Observable';
import { createSelector, Store } from '@ngrx/store';

import { SectionFactoryComponent } from './section.factory';
import { submissionSelector, SubmissionState } from '../submission.reducers';

import { hasValue, isUndefined } from '../../shared/empty.util';
import { DisableSectionAction, EnableSectionAction } from '../objects/submission-objects.actions';
import { SubmissionObjectEntry, SubmissionSectionObject } from '../objects/submission-objects.reducer';
import {
  sectionDefinitionFromIdSelector,
  submissionDefinitionFromIdSelector, submissionObjectFromIdSelector,
  submissionSectionFromIdSelector
} from '../selectors';

import { SubmissionDefinitionsConfigService } from '../../core/config/submission-definitions-config.service';
import { SubmissionSectionsConfigService } from '../../core/config/submission-sections-config.service';
import { SubmissionSectionModel } from '../../core/shared/config/config-submission-section.model';
import { SectionDataObject } from './section-data.model';

@Injectable()
export class SectionService {

  private viewContainerRef: ViewContainerRef;

  constructor(private definitionsConfigService: SubmissionDefinitionsConfigService,
              private sectionsConfigService: SubmissionSectionsConfigService,
              private sectionFactory: SectionFactoryComponent,
              private store: Store<SubmissionState>) {}

  initViewContainer(viewContainerRef: ViewContainerRef) {
    this.viewContainerRef = viewContainerRef;
  }

  private getDefinitionSections(definitionId: string) {
    return this.store.select(submissionDefinitionFromIdSelector(definitionId))
      .filter((state) => !isUndefined(state))
      .map((state) => state.sections)
      .distinctUntilChanged();
  }

  public getAvailableSectionList(submissionId, definitionId): Observable<any> {
    const submissionObjectsSelector = createSelector(submissionSelector, (state: SubmissionState) => state.objects);
    return this.store.select(submissionDefinitionFromIdSelector(definitionId))
      .flatMap((definition) => {
        let availableSections: any[] = [];
        return this.store.select(submissionObjectsSelector)
          .map((submissionState) => {
            if (!isUndefined(definition)) {
              availableSections = [];
              Object.keys(definition.sections).forEach((sectionId) => {
                if (!isUndefined(submissionState[submissionId])
                  && !isUndefined(submissionState[submissionId].sections)
                  && Object.keys(submissionState[submissionId].sections).length !== 0
                  && !submissionState[submissionId].sections.hasOwnProperty(sectionId)) {
                  availableSections.push({id: sectionId, header: definition.sections[sectionId].header} as SectionDataObject);
                }
              });
            }
            return availableSections;
          })
      })
  }

  public getSectionDefinition(definitionId, sectionId): Observable<SubmissionSectionModel> {
    return this.store.select(sectionDefinitionFromIdSelector(definitionId, sectionId))
      .map((panel: SubmissionSectionModel) => panel)
      .distinctUntilChanged();
  }

  public getSectionState(submissionId, sectionId): Observable<SubmissionSectionObject> {
    return this.store.select(submissionSectionFromIdSelector(submissionId, sectionId))
      .filter((sectionObj) => hasValue(sectionObj))
      .map((sectionObj: SubmissionSectionObject) => sectionObj)
      .distinctUntilChanged();
  }

  public isSectionValid(submissionId, sectionId): Observable<boolean> {
    return this.store.select(submissionSectionFromIdSelector(submissionId, sectionId))
      .filter((sectionObj) => hasValue(sectionObj))
      .map((sectionObj: SubmissionSectionObject) => sectionObj.isValid)
      .distinctUntilChanged();
  }

  public isSectionLoaded(submissionId, sectionId): Observable<boolean> {
    return this.store.select(submissionObjectFromIdSelector(submissionId))
      .map((submissionState: SubmissionObjectEntry) => {
        return !isUndefined(submissionState.sections[sectionId])
      })
      .distinctUntilChanged();
  }

  public loadDefaultSections(submissionId, definitionId) {
    this.store.select(submissionDefinitionFromIdSelector(definitionId))
      .distinctUntilChanged()
      .filter((state) => !isUndefined(state.sections))
      .subscribe((state) => {
        Object.keys(state.sections)
          .filter((sectionId) => state.sections[sectionId].mandatory)
          .map((sectionId) => {
            this.loadSection(submissionId, definitionId, sectionId);
          })
      })
  }

  private loadSection(submissionId: string, definitionId: string, sectionId: string) {
    let sectionObject: SubmissionSectionModel = Object.create(null);
    this.getSectionDefinition(definitionId, sectionId)
      .subscribe((sectionObj: SubmissionSectionModel) => {
        sectionObject = sectionObj;
      });
    const componentRef = this.sectionFactory.get(submissionId, sectionId, sectionObject, this.viewContainerRef);
    const viewIndex = this.viewContainerRef.indexOf(componentRef.hostView);
    this.store.dispatch(new EnableSectionAction(submissionId, sectionId, viewIndex));
  }

  public addSection(submissionId, definitionId, sectionId) {
    this.loadSection(submissionId, definitionId, sectionId);
  }

  public removeSection(submissionId, sectionId) {
    let sectionObject: SubmissionSectionObject = Object.create(null);
    this.getSectionState(submissionId, sectionId)
      .subscribe((sectionObj: SubmissionSectionObject) => {
        sectionObject = sectionObj;
      });
    this.viewContainerRef.remove(sectionObject.sectionViewIndex);
    this.store.dispatch(new DisableSectionAction(submissionId, sectionId));
  }
}
