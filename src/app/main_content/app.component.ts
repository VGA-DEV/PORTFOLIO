import { animate, animateChild, group, query, state, style, transition, trigger } from '@angular/animations';
import {Component,HostListener,OnInit} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { PopUpComponent } from '../pop-up/pop-up.component';
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  animations:[
    /*Hides menu*/
    trigger('toggle',[
      state('hide',style({
        overflow: "hidden",
        height:0
      })),
      state('show',style({
        height: '*',
        overflow: "hidden"
      })),
      transition('hide => show',[
        animate('100ms')
      ]),
      transition('show => hide',[
        animate('100ms')
      ])
    ]),
    /*Change icon*/
    trigger('toggle_icon',[
      state('ham',style({
        transform: 'translateY(0%)',
        height: '*',
      })),
      state('close',style({
        transform: 'translateY(-100px)',
        height: 0,
      })),
      transition('ham => close',[
        animate('350ms')
      ]),
      transition('close => ham',[
        animate('350ms')
      ])
    ]),
    /*Change color move*/
    trigger('toggle_list',[
      state('up',style({
        backgroundColor:'*'
      })),
      state('moved',style({
        backgroundColor:'#E8E5F7'
      })),
      transition('moved => up',[
        animate('150ms'),
      ]),
      transition('up => moved',[
        animate('150ms'),
      ])
    ]),
    /*Change color move*/
    trigger('toggle_header',[
      state('up',style({
        backgroundColor:'*'
      })),
      state('moved',style({
        backgroundColor:'#E8E5F7'
      })),
      transition('up => moved',[
        group([
          query('@toggle_list', animateChild()),
          animate('150ms')
        ])
      ]),
      transition('moved => up',[
        group([
          query('@toggle_list',animateChild()),
          animate('150ms'),
        ])
      ])
    ]),
  ]
})
export class AppComponent implements OnInit{
  title = 'portfolio';
  toggle:boolean = false
  header_moved:boolean = false
  skills:number = 0
  constructor(private dialog:MatDialog){
    
  }
  ngOnInit(): void {

  }
  protected toggleMenu(){
    this.toggle = !this.toggle  
  }
  @HostListener('window:scroll', ['$event'])
  protected detectScroll(){
      if(window.scrollY > 30){
        this.header_moved = true
      }else{
        this.header_moved = false
      }
  }
  protected mailContact(){
    this.dialog.open(PopUpComponent,{width:'80%'})
  }
  protected setSkill(skillPoints:number):number{
    this.skills = skillPoints
    return skillPoints
  }
  protected getHole():number{
    return 5-this.skills
  }

}
